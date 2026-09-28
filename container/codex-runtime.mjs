import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const registry = 'https://registry.npmjs.org';
const entry = 'node_modules/@openai/codex/bin/codex.js';
const receiptName = 'intentforge-install.json';
const stable = value => typeof value === 'string' && /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(value)
  && value.split('.').every(part => Number.isSafeInteger(Number(part)));
const compare = (a, b) => {
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  return 0;
};
const integrityOK = value => typeof value === 'string' && /^sha(?:1|256|384|512)-[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length < 512;
const message = error => String(error?.message ?? 'Runtime check failed').split(/[\r\n]/)[0].slice(0, 240);
const cancelled = () => new Error('Codex runtime preparation was cancelled');
const cleanupCode = 'CODEX_PROBE_CLEANUP_FAILED';
const cleanupFailed = () => Object.assign(new Error('Codex runtime cleanup did not finish within 2.5 seconds; no other runtime will be tried'), { code: cleanupCode });
function rethrowFatal(error, signal) {
  if (error?.code === cleanupCode) throw error;
  if (signal?.aborted) throw cancelled();
}

async function bounded(operation, milliseconds, signal) {
  if (signal?.aborted) throw cancelled();
  if (milliseconds < 1) throw new Error('Codex runtime preparation exhausted its startup budget');
  const controller = new AbortController();
  let timer, abort;
  try {
    return await new Promise((resolve, reject) => {
      let interrupted = false;
      const work = Promise.resolve().then(() => operation(controller.signal));
      const interrupt = error => {
        if (interrupted) return;
        interrupted = true;
        controller.abort();
        // Real operations terminate their children on abort. Wait for cleanup,
        // with a final bound for an unavailable transport or faulty operation.
        let cutoff;
        Promise.race([
          work.then(() => error, failure => failure?.code === cleanupCode ? failure : error),
          new Promise(done => { cutoff = setTimeout(() => done(cleanupFailed()), 2500); }),
        ]).then(failure => { clearTimeout(cutoff); reject(failure); });
      };
      abort = () => interrupt(cancelled());
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => interrupt(new Error('Codex runtime operation exceeded its time limit')), milliseconds);
      work.then(value => { if (!interrupted) resolve(value); }, error => { if (!interrupted) reject(error); });
    });
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

async function jsonFile(file, limit = 65536) {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > limit) throw new Error('Runtime metadata is not a bounded ordinary file');
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error instanceof SyntaxError) throw new Error('Runtime metadata contains invalid JSON'); throw error; }
}

async function metadataFromRegistry({ version, signal }) {
  const url = `${registry}/@openai%2fcodex${version ? `/${version}` : ''}`;
  const response = await fetch(url, { signal, redirect: 'error', headers: { accept: 'application/vnd.npm.install-v1+json' } });
  if (!response.ok) throw new Error(`Official npm metadata returned HTTP ${response.status}`);
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 32 * 1024 * 1024) throw new Error('Official npm metadata exceeded 32 MiB');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('Official npm metadata contains invalid JSON'); }
}

async function installFromRegistry({ version, directory, integrity, signal }) {
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ private: true }) + '\n', { mode: 0o600, flag: 'wx' });
  const cache = path.join(directory, 'npm-cache');
  const temporary = path.join(directory, 'tmp');
  const userConfig = path.join(directory, 'npm-user.conf');
  const globalConfig = path.join(directory, 'npm-global.conf');
  await mkdir(temporary, { mode: 0o700 });
  await writeFile(userConfig, '', { mode: 0o600, flag: 'wx' });
  await writeFile(globalConfig, '', { mode: 0o600, flag: 'wx' });
  const log = await open(path.join(directory, 'npm-install.log'), 'wx', 0o600);
  let child, killTimer;
  const terminate = () => {
    child?.kill('SIGTERM');
    killTimer = setTimeout(() => child?.kill('SIGKILL'), 2000);
    killTimer.unref();
  };
  try {
    const code = await new Promise((resolve, reject) => {
      child = spawn('/usr/local/bin/npm', ['install', '--prefix', directory, '--save-exact', '--include=optional', '--ignore-scripts', '--no-audit', '--no-fund',
        '--no-update-notifier', '--userconfig', userConfig, '--globalconfig', globalConfig, '--cache', cache, `--registry=${registry}`, `@openai/codex@${version}`],
      { cwd: directory, env: { PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'C.UTF-8', TMPDIR: temporary }, stdio: ['ignore', log.fd, log.fd] });
      signal.addEventListener('abort', terminate, { once: true });
      if (signal.aborted) terminate();
      child.once('error', () => reject(new Error('Could not start npm; see the retained installation log')));
      child.once('close', (status, killed) => killed ? reject(new Error('npm installation was interrupted')) : resolve(status));
    });
    if (code !== 0) throw new Error(`npm installation failed with exit ${code}; see the retained installation log`);
  } finally {
    signal.removeEventListener('abort', terminate);
    clearTimeout(killTimer);
    await log.close();
  }
  const lock = await jsonFile(path.join(directory, 'package-lock.json'), 4 * 1024 * 1024);
  const installed = lock.packages?.['node_modules/@openai/codex'];
  if (installed?.version !== version || installed.integrity !== integrity) throw new Error('Installed Codex identity or integrity differs from official npm metadata');
  const packages = {};
  for (const [name, item] of Object.entries(lock.packages ?? {})) {
    if (!name) continue;
    if (!item.resolved?.startsWith(`${registry}/`) || !integrityOK(item.integrity)) throw new Error('Installed dependency lacks official npm identity and integrity');
    packages[name] = { version: item.version, integrity: item.integrity };
  }
  return { integrity, packages };
}

async function commandAt(directory, version) {
  const manifest = await jsonFile(path.join(directory, 'node_modules/@openai/codex/package.json'));
  if (manifest.name !== '@openai/codex' || manifest.version !== version) throw new Error('Installed Codex package identity differs from the selected version');
  const command = path.join(directory, entry);
  const info = await lstat(command);
  if (!info.isFile() || info.isSymbolicLink() || !(await realpath(command)).startsWith(`${await realpath(directory)}${path.sep}`)) {
    throw new Error('Installed Codex command is missing or outside its installation');
  }
  return command;
}

async function cachedInstallations(root, log) {
  const result = [], versions = path.join(root, 'versions');
  for (const item of await readdir(versions, { withFileTypes: true })) {
    if (!item.isDirectory() || !stable(item.name)) continue;
    const versionRoot = path.join(versions, item.name);
    for (const installation of await readdir(versionRoot, { withFileTypes: true })) {
      if (!installation.isDirectory()) continue;
      const directory = path.join(versionRoot, installation.name);
      try {
        const receipt = await jsonFile(path.join(directory, receiptName));
        if (receipt.schema !== 'intentforge.codex-install/1' || receipt.version !== item.name || !integrityOK(receipt.integrity)) throw new Error('Invalid saved installation receipt');
        result.push({ version: item.name, command: await commandAt(directory, item.name), source: 'cached', integrity: receipt.integrity, packages: receipt.packages });
      } catch (error) { log(`Codex ${item.name}: retained installation is unusable (${message(error)}).`); }
    }
  }
  return result.sort((a, b) => compare(b.version, a.version));
}

/** Select once before services start. Installs and failed attempts remain on disk. */
export async function prepareCodexRuntime({ root = '/state/tools/codex', bundled = '/opt/codex/bin/codex.js', bundledVersion = '0.153.4',
  requestedVersion = process.env.INTENTFORGE_CODEX_VERSION ?? 'latest', timeoutMilliseconds = 90000, maxDownloads = 5,
  fetchMetadata = metadataFromRegistry, installVersion = installFromRegistry, probe, log = line => console.error(line), signal } = {}) {
  if (!stable(bundledVersion)) throw new Error('The bundled Codex version must be an exact stable version');
  if (!['latest', 'bundled'].includes(requestedVersion) && !stable(requestedVersion)) throw new Error('INTENTFORGE_CODEX_VERSION must be latest, bundled, or an exact stable version');
  if (!Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds < 1 || !Number.isInteger(maxDownloads) || maxDownloads < 0 || maxDownloads > 5) throw new Error('Invalid Codex runtime preparation budget');
  if (signal?.aborted) throw cancelled();
  probe ??= (await import('./codex-probe.mjs')).probeCodex;
  const deadline = Date.now() + timeoutMilliseconds;
  const remaining = () => Math.max(0, deadline - Date.now());
  const fallbackReserve = Math.min(20000, Math.floor(timeoutMilliseconds / 3));
  const primaryBudget = () => Math.max(0, remaining() - (requestedVersion === 'latest' ? fallbackReserve : 0));
  root = path.resolve(root);
  await mkdir(root, { recursive: true, mode: 0o700 });
  if (!(await lstat(root)).isDirectory() || (await lstat(root)).isSymbolicLink()) throw new Error('Codex runtime storage must be an ordinary directory');
  for (const name of ['versions', 'staging', 'probes']) {
    const directory = path.join(root, name);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (!(await lstat(directory)).isDirectory() || (await lstat(directory)).isSymbolicLink()) throw new Error('Codex runtime storage contains an unsafe directory');
  }
  const attempts = [];
  const failed = (version, stage, error, directory) => {
    const reason = message(error);
    attempts.push({ version, stage, status: 'failed', reason, ...(directory ? { directory } : {}) });
    log(`Codex ${version ?? 'selection'}: ${stage} failed (${reason}).`);
  };
  let previous;
  try {
    previous = await jsonFile(path.join(root, 'selection.json'));
    if (previous.schema !== 'intentforge.codex-selection/1' || !stable(previous.version) || !path.isAbsolute(previous.command ?? '')) throw new Error('Invalid selected runtime metadata');
    if (!(await lstat(previous.command)).isFile()) throw new Error('Selected runtime command is missing');
  } catch (error) {
    if (error.code === 'ENOENT' && !previous) log('Codex: no saved runtime selection; preparing this launch.');
    else failed(previous?.version, 'saved selection', error);
    previous = undefined;
  }
  const cached = await cachedInstallations(root, log);
  if (previous) cached.sort((a, b) => (a.command === previous.command ? -1 : b.command === previous.command ? 1 : compare(b.version, a.version)));
  const tested = new Set();
  const activate = async candidate => {
    if (signal?.aborted) throw cancelled();
    const selection = { schema: 'intentforge.codex-selection/1', requestedVersion, ...candidate, selectedAt: new Date().toISOString(), attempts };
    const temporary = path.join(root, `selection-${randomUUID()}.next`);
    await writeFile(temporary, JSON.stringify(selection, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(temporary, path.join(root, 'selection.json'));
    log(`Codex ${selection.version} selected for this launch (${selection.source}).`);
    return selection;
  };
  const check = async (candidate, milliseconds) => {
    if (tested.has(candidate.command)) return false;
    tested.add(candidate.command);
    const directory = path.join(root, 'probes', randomUUID());
    try {
      const report = await bounded(probeSignal => probe({ command: candidate.command, version: candidate.version, directory,
        timeoutMilliseconds: Math.min(15000, milliseconds), signal: probeSignal }), Math.min(15000, milliseconds), signal);
      attempts.push({ version: candidate.version, stage: 'probe', source: candidate.source, status: 'passed', directory, report });
      return true;
    } catch (error) { rethrowFatal(error, signal); failed(candidate.version, 'probe', error, directory); return false; }
  };
  const bundledCandidate = { version: bundledVersion, command: bundled, source: 'bundled', integrity: null };
  const download = async (version, metadata) => {
    const integrity = metadata?.dist?.integrity;
    if (!integrityOK(integrity)) { failed(version, 'metadata', new Error('Official npm release lacks valid integrity')); return null; }
    const directory = path.join(root, 'staging', `${version}-${randomUUID()}`);
    await mkdir(directory, { mode: 0o700 });
    await writeFile(path.join(directory, 'release.json'), JSON.stringify({ name: '@openai/codex', version, integrity, registry }) + '\n', { mode: 0o600 });
    try {
      const installed = await bounded(installSignal => installVersion({ version, directory, integrity, registry,
        timeoutMilliseconds: Math.min(30000, primaryBudget()), signal: installSignal }), Math.min(30000, primaryBudget()), signal);
      if (installed?.integrity !== integrity) throw new Error('Installed package integrity differs from selected npm release');
      const candidate = { version, command: await commandAt(directory, version), source: 'installed', integrity, packages: installed.packages };
      const attempt = { version, stage: 'install', status: 'passed', directory };
      attempts.push(attempt);
      if (!await check(candidate, primaryBudget())) return null;
      await writeFile(path.join(directory, receiptName), JSON.stringify({ schema: 'intentforge.codex-install/1', version, integrity,
        packages: installed.packages, installedAt: new Date().toISOString() }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      const versionRoot = path.join(root, 'versions', version);
      await mkdir(versionRoot, { recursive: true, mode: 0o700 });
      if ((await lstat(versionRoot)).isSymbolicLink()) throw new Error('Selected version directory is unsafe');
      const destination = path.join(versionRoot, randomUUID());
      await rename(directory, destination);
      attempt.directory = destination;
      candidate.command = path.join(destination, entry);
      return candidate;
    } catch (error) { rethrowFatal(error, signal); failed(version, 'install', error, directory); return null; }
  };
  if (requestedVersion === 'bundled' || requestedVersion === bundledVersion) {
    if (await check(bundledCandidate, remaining())) return activate(bundledCandidate);
    throw new Error(`Requested Codex ${requestedVersion} failed its runtime probe; no alternate version was selected`);
  }
  if (requestedVersion !== 'latest') {
    for (const candidate of cached.filter(item => item.version === requestedVersion)) if (await check(candidate, remaining())) return activate(candidate);
    try {
      const metadata = await bounded(metadataSignal => fetchMetadata({ version: requestedVersion, signal: metadataSignal,
        timeoutMilliseconds: Math.min(10000, remaining()) }), Math.min(10000, remaining()), signal);
      const candidate = await download(requestedVersion, metadata.versions?.[requestedVersion] ?? metadata);
      if (candidate) return activate(candidate);
    } catch (error) { rethrowFatal(error, signal); failed(requestedVersion, 'metadata', error); }
    throw new Error(`Requested Codex ${requestedVersion} could not be prepared; no alternate version was selected`);
  }
  let versions = [], metadata;
  try {
    metadata = await bounded(metadataSignal => fetchMetadata({ signal: metadataSignal, timeoutMilliseconds: Math.min(10000, primaryBudget()) }), Math.min(10000, primaryBudget()), signal);
    const latest = metadata['dist-tags']?.latest;
    if (!stable(latest) || !metadata.versions?.[latest]) throw new Error('Official npm metadata has no stable latest release');
    versions = Object.keys(metadata.versions).filter(version => stable(version) && compare(version, latest) <= 0 && compare(version, bundledVersion) > 0).sort((a, b) => compare(b, a));
  } catch (error) { rethrowFatal(error, signal); failed(null, 'registry lookup', error); }
  let downloads = 0;
  for (const version of versions) {
    if (primaryBudget() < 1) break;
    for (const candidate of cached.filter(item => item.version === version)) if (await check(candidate, primaryBudget())) return activate(candidate);
    if (downloads >= maxDownloads) continue;
    downloads++;
    const candidate = await download(version, metadata.versions[version]);
    if (candidate) return activate(candidate);
  }
  log('Codex: using a verified retained runtime after the latest-release attempts.');
  const latest = metadata?.['dist-tags']?.latest;
  for (const candidate of cached.filter(item => compare(item.version, bundledVersion) >= 0 && (!stable(latest) || compare(item.version, latest) <= 0))) {
    const budget = remaining() - Math.min(10000, fallbackReserve / 2);
    if (budget < 1) break;
    if (await check(candidate, budget)) return activate(candidate);
  }
  if (await check(bundledCandidate, remaining())) return activate(bundledCandidate);
  throw new Error('No Codex runtime passed preparation within the startup budget; see the retained attempts and probe logs');
}
