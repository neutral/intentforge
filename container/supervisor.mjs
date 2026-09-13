import http from 'node:http';
import { spawn } from 'node:child_process';
import { chmod, mkdir, open, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const names = ['forge', 'intent', 'atlas'];
const ports = { forge: 4310, intent: 8787, atlas: 4721 };
const loopback = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function localOrigin(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} must be an exact loopback HTTP origin`); }
  if (url.protocol !== 'http:' || !loopback.has(url.hostname) || url.origin !== value || url.username || url.password) {
    throw new Error(`${label} must be an exact loopback HTTP origin, including its published port`);
  }
  return value;
}

export function configuration(env = process.env) {
  const origins = {
    suite: localOrigin(env.INTENTFORGE_ORIGIN ?? 'http://127.0.0.1:4800', 'INTENTFORGE_ORIGIN'),
    forge: localOrigin(env.FORGE_ORIGIN ?? 'http://127.0.0.1:4310', 'FORGE_ORIGIN'),
    intent: localOrigin(env.INTENT_ORIGIN ?? 'http://127.0.0.1:8787', 'INTENT_ORIGIN'),
    atlas: localOrigin(env.ATLAS_ORIGIN ?? 'http://127.0.0.1:4721', 'ATLAS_ORIGIN'),
    preview: localOrigin(env.ATLAS_PREVIEW_ORIGIN ?? 'http://127.0.0.1:4722', 'ATLAS_PREVIEW_ORIGIN'),
  };
  if (new Set(Object.values(origins)).size !== 5) throw new Error('Each browser service and Atlas preview needs a separate origin');
  if (!env.FORGE_CONTAINER || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(env.FORGE_CONTAINER)) throw new Error('FORGE_CONTAINER must be the selected Docker container name');
  const atlasPath = env.ATLAS_PATH ?? 'atlas';
  const resolvedAtlas = path.resolve('/workspace', atlasPath);
  if (!atlasPath || (resolvedAtlas !== '/workspace' && !resolvedAtlas.startsWith('/workspace/'))) throw new Error('ATLAS_PATH must select a collection inside /workspace');
  return { origins, atlasPath: path.relative('/workspace', resolvedAtlas) || '.', container: env.FORGE_CONTAINER };
}

export function componentCommands(config) {
  return {
    forge: { command: '/usr/local/bin/node', args: ['/opt/forge/runtime/worker-entry.mjs'], env: {
      FORGE_NODE: '/usr/local/bin/node', FORGE_CONTAINER: config.container,
      FORGE_WORKSPACE: '/workspace', FORGE_DIRECTIONS: '/workspace/.forge/directions',
      CODEX_HOME: '/state/codex', FORGE_BIND: '0.0.0.0', FORGE_PORT: '4310',
    } },
    intent: { command: '/opt/intent/bin/intent', args: ['open', '/workspace', '--no-browser', '--bind', '0.0.0.0', '--port', '8787', '--origin', config.origins.intent, '--state-dir', '/state/intent'], env: { INTENT_NODE: '/usr/local/bin/node' } },
    atlas: { command: '/opt/atlas/bin/atlas', args: ['open', '/workspace', '--atlas', config.atlasPath, '--bind', '0.0.0.0', '--port', '4721', '--origin', config.origins.atlas, '--no-browser', '--state-directory', '/state/atlas/editor', '--cache-directory', '/cache', '--export-dir', '/exports/atlas-site', '--preview-port', '4722', '--preview-origin', config.origins.preview], env: { ATLAS_NODE: '/usr/local/bin/node' } },
  };
}

export function consumeReadiness(name, line, config, service) {
  if (name === 'forge') {
    if (!line.startsWith('{')) return;
    let record;
    try { record = JSON.parse(line); } catch { return; }
    if (record.type === 'cockpit_listening' && record.port === 4310) {
      service.launchUrl = `${config.origins.suite}/work`;
      service.announced = true;
    }
    return;
  }
  const prefix = name === 'intent' ? 'Intent ready: ' : 'Open: ';
  if (line.startsWith(prefix)) {
    const value = line.slice(prefix.length).trim();
    let url;
    try { url = new URL(value); } catch { throw new Error(`${name} announced an invalid launch URL`); }
    if (url.origin !== config.origins[name] || url.username || url.password || url.pathname !== '/') throw new Error(`${name} announced a launch URL outside its configured origin`);
    const token = name === 'intent' ? url.searchParams.get('token') : new URLSearchParams(url.hash.slice(1)).get('token');
    if (!token) throw new Error(`${name} announced a launch URL without a session token`);
    service.launchUrl = value;
    if (name === 'intent') service.announced = true;
  }
  if (name === 'atlas' && line.startsWith('Ready: ')) {
    let record;
    try { record = JSON.parse(line.slice(7)); } catch { throw new Error('Atlas announced invalid readiness metadata'); }
    if (record.event !== 'atlas.ready' || record.origin !== config.origins.atlas || record.repositoryRoot !== '/workspace' || record.atlasPath !== config.atlasPath) throw new Error('Atlas readiness does not match the selected project, collection and origin');
    service.announced = true;
  }
}

function protect(req, origin) {
  if (req.headers.host?.toLowerCase() !== new URL(origin).host) return false;
  if (req.headers.origin && req.headers.origin !== origin) return false;
  if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) return false;
  return true;
}

export function publicStatus(services, includeLinks = false) {
  return Object.fromEntries(names.map(name => [name, {
    status: services[name].status,
    ...(services[name].error ? { error: services[name].error } : {}),
    ...(includeLinks && services[name].status === 'ready' ? { url: services[name].launchUrl } : {}),
  }]));
}

function cockpitRoute(url) {
  if (url.pathname === '/work') return { path: `/${url.search}`, methods: ['GET'] };
  if (['/cockpit.css', '/cockpit.js', '/api/session', '/api/diff'].includes(url.pathname)) return { path: `${url.pathname}${url.search}`, methods: ['GET'] };
  if (url.pathname === '/api/directions' || url.pathname.startsWith('/api/directions/')) return { path: `${url.pathname}${url.search}`, methods: ['GET', 'POST'] };
  return null;
}

function forwardCockpit(req, res, route, port) {
  const limit = 256 * 1024;
  let failed = false;
  let size = 0;
  let upstream;
  const reject = (status, message) => {
    if (failed) return;
    failed = true;
    upstream?.destroy();
    req.resume();
    if (res.headersSent) { res.destroy(); return; }
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: message }));
  };
  if (Number(req.headers['content-length'] ?? 0) > limit) return reject(413, 'Cockpit request exceeds 256 KiB.');
  // These are the original browser headers. In particular, Host, Origin,
  // Sec-Fetch-Site and x-forge-token are neither invented nor rewritten.
  upstream = http.request({ hostname: '127.0.0.1', port, method: req.method, path: route.path, headers: req.headers }, response => {
    if (failed) { response.destroy(); return; }
    res.writeHead(response.statusCode, response.headers);
    response.on('error', () => res.destroy());
    response.pipe(res);
  });
  upstream.setTimeout(125000, () => reject(504, 'Forge did not respond within the service timeout.'));
  upstream.on('error', () => reject(502, 'Forge is unavailable. Check the environment status and private service logs.'));
  upstream.on('drain', () => { if (!failed) req.resume(); });
  req.on('data', chunk => {
    if (failed) return;
    size += chunk.length;
    if (size > limit) return reject(413, 'Cockpit request exceeds 256 KiB.');
    if (!upstream.write(chunk)) req.pause();
  });
  req.on('end', () => { if (!failed) upstream.end(); });
  req.on('aborted', () => upstream.destroy());
  req.on('error', () => upstream.destroy());
  res.on('close', () => { if (!res.writableFinished) upstream.destroy(); });
}

export async function startLanding({ origin, services, port = 4800, bind = '0.0.0.0', assetDirectory = path.join(here, 'landing'), forgePort = 4310 }) {
  const assets = new Map(await Promise.all([
    ['/', 'index.html', 'text/html; charset=utf-8'],
    ['/style.css', 'style.css', 'text/css; charset=utf-8'],
    ['/app.js', 'app.js', 'text/javascript; charset=utf-8'],
  ].map(async ([route, file, type]) => [route, { body: await readFile(path.join(assetDirectory, file)), type }])));
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    if (!protect(req, origin)) return json(403, { error: 'Use the saved IntentForge origin. Cross-origin access is not allowed.' });
    if (req.headers.upgrade || /(?:^|,)\s*upgrade\s*(?:,|$)/i.test(req.headers.connection ?? '')) return json(403, { error: 'Connection upgrades are not supported.' });
    let url;
    try { url = new URL(req.url, origin); } catch { return json(400, { error: 'Invalid request URL.' }); }
    if (url.origin !== origin) return json(403, { error: 'Use the saved IntentForge origin.' });
    const route = cockpitRoute(url);
    if (route) {
      if (!route.methods.includes(req.method)) return json(405, { error: 'This cockpit route does not support that method.' });
      return forwardCockpit(req, res, route, forgePort);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(405, { error: 'Use GET or HEAD.' });
    if (url.pathname === '/healthz') {
      const ready = names.every(name => services[name].status === 'ready');
      return json(ready ? 200 : 503, { ready, scope: 'services only; agent authentication and Worker delivery are not checked', services: publicStatus(services) });
    }
    if (url.pathname === '/api/services') return json(200, { workspace: '/workspace', authentication: 'not checked', services: publicStatus(services, true) });
    const asset = assets.get(url.pathname);
    if (!asset) return json(404, { error: 'Not found.' });
    res.writeHead(200, { 'Content-Type': asset.type });
    res.end(req.method === 'HEAD' ? undefined : asset.body);
  });
  server.on('upgrade', (req, socket) => { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, bind, resolve); });
  return server;
}

async function probe(name, service, config) {
  if (!service.announced || !service.launchUrl) return false;
  const url = new URL(service.launchUrl);
  return new Promise(resolve => {
    const request = http.get({ hostname: '127.0.0.1', port: ports[name], path: name === 'forge' ? '/api/session' : `${url.pathname}${url.search}`, headers: { Host: new URL(config.origins[name]).host }, timeout: 2500 }, response => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on('error', () => resolve(false));
    request.on('timeout', () => { request.destroy(); resolve(false); });
  });
}

export async function runSupervisor({ env = process.env, commands, stateDirectory = '/state', runDirectory = '/run/intentforge', landingPort = 4800, probeService = probe, startupMilliseconds = 90000, workspaceDirectory = '/workspace', additionalDirectories = ['/cache', '/exports'] } = {}) {
  const config = configuration(env);
  if (!(await stat(workspaceDirectory)).isDirectory()) throw new Error('/workspace must be the selected project directory');
  process.umask(0o077);
  const logDirectory = path.join(stateDirectory, 'service-logs');
  for (const directory of [logDirectory, runDirectory, ...['codex', 'intent', 'atlas/editor', 'atlas/agent'].map(value => path.join(stateDirectory, value)), ...additionalDirectories]) await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(logDirectory, 0o700);
  await chmod(runDirectory, 0o700);
  const services = Object.fromEntries(names.map(name => [name, { status: 'starting', announced: false }]));
  const children = new Map();
  const logs = [];
  const outputWrites = new Map();
  const preparedLogs = new Map();
  try {
    for (const name of names) {
      const log = await open(path.join(logDirectory, `${name}.log`), 'a', 0o600);
      logs.push(log);
      await log.chmod(0o600);
      await log.write(`\n--- IntentForge service launch ${new Date().toISOString()} ---\n`);
      preparedLogs.set(name, log);
    }
  } catch (error) { await Promise.all(logs.map(log => log.close())); throw error; }
  let stopping = false;
  let checkTimer;
  let startupTimer;
  let finish;
  let writes = Promise.resolve();
  const complete = new Promise(resolve => { finish = resolve; });
  const record = () => {
    const text = JSON.stringify({ container: config.container, origin: config.origins.suite, workspace: '/workspace', atlasPath: config.atlasPath, updatedAt: new Date().toISOString(), services }, null, 2) + '\n';
    writes = writes.then(async () => { const target = path.join(runDirectory, 'status.json'); await writeFile(`${target}.next`, text, { mode: 0o600 }); await rename(`${target}.next`, target); });
    writes.catch(error => { console.error(`IntentForge status could not be saved: ${error.message}`); });
    return writes;
  };
  let landing;
  try { landing = await startLanding({ origin: config.origins.suite, services, port: landingPort }); }
  catch (error) { await Promise.all(logs.map(log => log.close())); throw error; }
  console.log(`IntentForge services starting. Open: ${config.origins.suite}`);
  console.log(`Service logs are private in ${logDirectory}. Authentication is not checked.`);
  async function stop(code, signal = 'SIGTERM') {
    if (stopping) return complete;
    stopping = true;
    clearInterval(checkTimer);
    clearTimeout(startupTimer);
    for (const name of names) if (services[name].status !== 'failed') services[name].status = 'stopping';
    const serverClosed = new Promise(resolve => landing.close(resolve));
    landing.closeIdleConnections();
    const cutoff = setTimeout(() => {
      landing.closeAllConnections();
      for (const { child } of children.values()) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    }, 10000);
    for (const { child } of children.values()) child.kill(signal);
    await Promise.all([serverClosed, ...[...children.values()].map(item => item.finished)]);
    clearTimeout(cutoff);
    for (const name of names) if (services[name].status !== 'failed') services[name].status = 'stopped';
    await record().catch(() => {});
    await Promise.all([...outputWrites.values()].map(pending => pending.catch(() => {})));
    await Promise.all(logs.map(log => log.close().catch(() => {})));
    for (const signalName of ['SIGTERM', 'SIGINT']) process.removeListener(signalName, signalHandlers[signalName]);
    finish(code);
    return code;
  }
  const signalHandlers = Object.fromEntries(['SIGTERM', 'SIGINT'].map(signal => [signal, () => void stop(0, signal)]));
  for (const [signal, handler] of Object.entries(signalHandlers)) process.on(signal, handler);
  const fail = (name, message) => {
    if (stopping) return;
    services[name].status = 'failed';
    services[name].error = message;
    console.error(`IntentForge ${name}: ${message}. Inspect ${logDirectory}/${name}.log`);
    void stop(1);
  };
  try {
    for (const [name, spec] of Object.entries(commands ?? componentCommands(config))) {
      if (stopping) break;
      const log = preparedLogs.get(name);
      const child = spawn(spec.command, spec.args, { cwd: workspaceDirectory, env: { ...env, ...spec.env }, detached: true, stdio: ['ignore', 'pipe', log.fd] });
      let exited;
      const finished = new Promise(resolve => { exited = resolve; });
      children.set(name, { child, finished });
      services[name].pid = child.pid;
      let buffer = '';
      child.stdout.on('data', chunk => {
        const pending = (outputWrites.get(name) ?? Promise.resolve()).then(() => log.write(chunk));
        outputWrites.set(name, pending);
        pending.catch(error => fail(name, `Private service log failed: ${error.message}`));
        buffer += chunk.toString('utf8');
        if (buffer.length > 256 * 1024) return fail(name, 'Service output exceeded the readiness line limit');
        let boundary;
        while ((boundary = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, boundary).replace(/\r$/, '');
          buffer = buffer.slice(boundary + 1);
          try { consumeReadiness(name, line, config, services[name]); } catch (error) { fail(name, error.message); }
        }
      });
      child.once('error', error => { fail(name, `Service could not start: ${error.message}`); });
      child.once('exit', (code, signal) => { if (!stopping) fail(name, `Service exited (${signal ?? code})`); });
      child.once('close', () => exited());
    }
    await record();
    if (stopping) return complete;
    const check = async () => {
      if (stopping) return;
      let changed = false;
      await Promise.all(names.map(async name => {
        const good = await probeService(name, services[name], config);
        if (stopping) return;
        const status = good ? 'ready' : services[name].status === 'starting' ? 'starting' : 'unavailable';
        if (services[name].status !== status) { services[name].status = status; changed = true; }
      }));
      if (stopping) return;
      if (names.every(name => services[name].status === 'ready')) clearTimeout(startupTimer);
      if (changed) await record();
    };
    checkTimer = setInterval(() => { void check().catch(error => fail('forge', `Readiness check failed: ${error.message}`)); }, 2000);
    startupTimer = setTimeout(() => {
      const missing = names.filter(name => services[name].status !== 'ready');
      if (missing.length) fail(missing[0], `Service startup timed out after ${startupMilliseconds / 1000}s`);
    }, startupMilliseconds);
    await check();
  } catch (error) {
    console.error(`IntentForge startup failed: ${error.message}`);
    await stop(1);
  }
  return complete;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { process.exitCode = await runSupervisor(); }
  catch (error) { console.error(`IntentForge startup failed: ${error.message}`); process.exitCode = 1; }
}
