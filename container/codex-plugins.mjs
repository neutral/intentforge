import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, realpath, rename } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const pluginId = 'trellis@intentforge';
const skills = ['shape-handbook', 'learn-from-work'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function inventory(root) {
  const files = [];
  let bytes = 0;
  async function visit(relative = '') {
    const location = path.join(root, relative), info = await lstat(location);
    if (info.isSymbolicLink()) throw new Error('Trellis package contains a symbolic link');
    if (info.isDirectory()) {
      for (const name of (await readdir(location)).sort()) await visit(path.join(relative, name));
    } else {
      if (!info.isFile() || info.size > 2 * 1024 * 1024 || (bytes += info.size) > 4 * 1024 * 1024 || files.length >= 256) throw new Error('Trellis package has an unsupported file or size');
      files.push({ path: relative, sha256: digest(await readFile(location)) });
    }
  }
  await visit();
  return files;
}

export async function readTrellisPackage(pluginRoot = '/opt/intentforge/plugins/trellis') {
  if (!path.isAbsolute(pluginRoot)) throw new Error('Trellis package root must be absolute');
  const files = await inventory(pluginRoot);
  const manifest = JSON.parse(await readFile(path.join(pluginRoot, 'plugin.json'), 'utf8'));
  if (manifest.name !== 'trellis' || manifest.license !== 'CC0-1.0' || !/^\d+\.\d+\.\d+$/.test(manifest.version ?? '')) throw new Error('Invalid bundled Trellis identity');
  for (const file of ['LICENSE', '.codex-plugin/plugin.json', ...skills.map(name => `skills/${name}/SKILL.md`)]) {
    if (!files.some(item => item.path === file)) throw new Error(`Bundled Trellis is missing ${file}`);
  }
  const codex = JSON.parse(await readFile(path.join(pluginRoot, '.codex-plugin/plugin.json'), 'utf8'));
  if (codex.name !== manifest.name || codex.version !== manifest.version || codex.license !== manifest.license || !['./skills', './skills/'].includes(codex.skills)) throw new Error('Bundled Trellis Codex manifest differs from its package identity');
  return { root: pluginRoot, version: manifest.version, pluginId, skills: [...skills], files };
}

export function pluginFromList(output, definition, installedPath) {
  const listing = typeof output === 'string' ? JSON.parse(output) : output;
  if (!Array.isArray(listing?.installed) || !Array.isArray(listing?.available)) throw new Error('Codex returned an unsupported plugin listing');
  const matches = listing.installed.filter(item => item.pluginId === definition.pluginId);
  if (matches.length > 1) throw new Error('Codex returned duplicate Trellis installations');
  if (!matches.length) return null;
  const item = matches[0];
  if (item.name !== 'trellis' || item.marketplaceName !== 'intentforge' || item.version !== definition.version || item.installed !== true || typeof item.enabled !== 'boolean'
    || item.source?.source !== 'local' || item.source.path !== definition.root
    || item.marketplaceSource?.sourceType !== 'local' || item.marketplaceSource.source !== path.dirname(path.dirname(definition.root))
    || installedPath && item.installedPath !== undefined && item.installedPath !== installedPath) {
    throw new Error('Installed Trellis differs from the image package; inspect the Codex plugin configuration');
  }
  return item;
}

export async function verifyInstalledTrellis(installedPath, definition) {
  if (typeof installedPath !== 'string' || !path.isAbsolute(installedPath)) throw new Error('Codex returned an invalid Trellis installation path');
  const actual = await inventory(installedPath);
  if (JSON.stringify(actual) !== JSON.stringify(definition.files)) throw new Error('Installed Trellis files differ from the image package; the existing installation was retained');
  return installedPath;
}

// Plugin commands use the selected Codex without opening a Worker.
async function commandJSON(command, args, { codexHome, workspace, logFile, signal, milliseconds }) {
  if (signal?.aborted) throw new Error('Trellis preparation cancelled');
  if (milliseconds < 1) throw new Error('Trellis preparation exhausted its startup budget');
  const log = await open(logFile, 'wx', 0o600);
  const child = spawn(process.execPath, [command, 'plugin', ...args], {
    cwd: workspace, env: { ...process.env, CODEX_HOME: codexHome }, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const finished = new Promise(resolve => { child.once('error', () => resolve({ failed: true })); child.once('close', (code, killed) => resolve({ code, killed })); });
  let output = '', size = 0, interrupted = false, killTimer, cutoff;
  let rejectInterrupted;
  const interruption = new Promise((_, reject) => { rejectInterrupted = reject; });
  const kill = value => { if (child.pid) try { process.kill(-child.pid, value); } catch (error) { if (error.code !== 'ESRCH') child.kill(value); } };
  const abort = () => {
    interrupted = true; kill('SIGTERM');
    killTimer ??= setTimeout(() => kill('SIGKILL'), 500);
    cutoff ??= setTimeout(() => rejectInterrupted(new Error('Codex plugin command did not stop within its cleanup deadline')), 1500);
  };
  const timer = setTimeout(abort, milliseconds);
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    size += chunk.length;
    if (size > 1024 * 1024) return abort();
    if (stream === child.stdout) output += chunk.toString('utf8');
    void log.write(chunk).catch(abort);
  });
  try {
    const result = await Promise.race([finished, interruption]);
    if (interrupted || result.failed || result.code !== 0 || result.killed) throw new Error(`Codex plugin command failed; inspect ${logFile}`);
    return JSON.parse(output);
  } finally {
    clearTimeout(timer); clearTimeout(killTimer); clearTimeout(cutoff); signal?.removeEventListener('abort', abort);
    kill('SIGTERM');
    await Promise.race([finished, delay(250)]);
    kill('SIGKILL');
    try {
      for (let attempt = 0; child.pid && attempt < 50; attempt++) {
        try { process.kill(-child.pid, 0); }
        catch (error) { if (error.code === 'ESRCH') break; throw new Error('Cannot confirm Codex plugin process shutdown'); }
        if (attempt === 49) throw new Error('Codex plugin process group did not stop');
        await delay(10);
      }
    } finally { await log.close(); }
  }
}

export async function prepareTrellis({ command, codexHome = '/state/codex', workspace = '/workspace',
  pluginRoot = '/opt/intentforge/plugins/trellis', directory, timeoutMilliseconds = 20000, signal, run = commandJSON } = {}) {
  if (![command, codexHome, workspace, directory].every(value => typeof value === 'string' && path.isAbsolute(value))) throw new Error('Trellis preparation requires absolute paths');
  if (!Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds < 1 || timeoutMilliseconds > 120000) throw new Error('Invalid Trellis preparation budget');
  if (signal?.aborted) throw new Error('Trellis preparation cancelled');
  const definition = await readTrellisPackage(pluginRoot), deadline = Date.now() + timeoutMilliseconds;
  await mkdir(codexHome, { recursive: true, mode: 0o700 });
  if ((await lstat(codexHome)).isSymbolicLink()) throw new Error('Codex home must be an ordinary directory');
  let parent = codexHome;
  for (const name of ['plugins', 'cache', 'intentforge', 'trellis']) {
    parent = path.join(parent, name);
    try { if (!(await lstat(parent)).isDirectory() || (await lstat(parent)).isSymbolicLink()) throw new Error('Trellis cache parents must be ordinary directories'); }
    catch (error) { if (error.code === 'ENOENT') break; throw error; }
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await lstat(directory)).isSymbolicLink() || (await readdir(directory)).length) throw new Error('Trellis preparation logs require an empty ordinary directory');
  let sequence = 0;
  const invoke = (args, home = codexHome) => run(command, args, { codexHome: home, workspace, signal, milliseconds: Math.max(0, deadline - Date.now()), logFile: path.join(directory, `${++sequence}.log`) });
  let installedPath = path.join(codexHome, 'plugins/cache/intentforge/trellis', definition.version);
  let installed = pluginFromList(await invoke(['list', '--json']), definition, installedPath);
  if (!installed) {
    // Retain incomplete or unrelated cache contents instead of overwriting them.
    try { await lstat(installedPath); throw new Error('Unregistered Trellis files already exist; inspect the retained Codex plugin cache'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    // Native installation writes enabled=true. Install in empty private state,
    // then promote only verified package files, preserving every user setting.
    const temporaryHome = path.join(directory, 'codex-home');
    const preparedPath = path.join(temporaryHome, 'plugins/cache/intentforge/trellis', definition.version);
    await mkdir(temporaryHome, { mode: 0o700 });
    const result = await invoke(['add', definition.pluginId, '--json'], temporaryHome);
    if (result.pluginId !== definition.pluginId || result.name !== 'trellis' || result.marketplaceName !== 'intentforge' || result.version !== definition.version || result.installedPath !== preparedPath) throw new Error('Codex installed an unexpected Trellis package');
    if (!(await realpath(preparedPath)).startsWith(`${await realpath(temporaryHome)}${path.sep}`)) throw new Error('Prepared Trellis installation escapes isolated state');
    await verifyInstalledTrellis(preparedPath, definition);
    if (signal?.aborted) throw new Error('Trellis preparation cancelled');
    await mkdir(path.dirname(installedPath), { recursive: true, mode: 0o700 });
    await rename(preparedPath, installedPath);
    installed = pluginFromList(await invoke(['list', '--json']), definition, installedPath);
    if (!installed) throw new Error('Codex did not register the Trellis plugin');
  }
  if (!(await realpath(installedPath)).startsWith(`${await realpath(codexHome)}${path.sep}`)) throw new Error('Trellis installation escapes private Codex state');
  await verifyInstalledTrellis(installedPath, definition);
  if (signal?.aborted) throw new Error('Trellis preparation cancelled');
  return { pluginId, version: definition.version, enabled: installed.enabled, installedPath, skills: definition.skills };
}
