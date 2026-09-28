import http from 'node:http';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { browserOrigin } from './supervisor.mjs';

const previewFiles = new Map([['index.html', 'text/html; charset=utf-8'], ['app.js', 'text/javascript; charset=utf-8'], ['search.js', 'text/javascript; charset=utf-8'], ['style.css', 'text/css; charset=utf-8'], ['data.json', 'application/json; charset=utf-8'], ['selection.json', 'application/json; charset=utf-8']]);
const inside = (root, target) => target === root || target.startsWith(root + path.sep);

/** Selection is read-only. Atlas itself rechecks the selection when it opens. */
export async function selectedAtlas(workspace, atlasPath) {
  workspace = await realpath(workspace);
  if (typeof atlasPath !== 'string' || (atlasPath !== '.' && (!atlasPath || atlasPath.normalize('NFC') !== atlasPath || /[\\:\x00-\x1f\x7f]/u.test(atlasPath) || path.isAbsolute(atlasPath) || atlasPath.split('/').some(part => !part || part === '.' || part === '..')))) {
    throw new Error('ATLAS_PATH must be an exact project-relative directory, or .');
  }
  let root = workspace;
  for (const part of atlasPath === '.' ? [] : atlasPath.split('/')) {
    if (!(await readdir(root)).includes(part)) throw new Error(`Selected Atlas directory does not exist: ${atlasPath}. Create that directory explicitly or select an existing one with --atlas-path; no collection was created.`);
    root = path.join(root, part);
    const info = await lstat(root);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Selected Atlas directory must stay inside the workspace without symlinks.');
  }
  return { workspace, root, atlasPath };
}

function protectedRequest(req, origin) {
  // A suite link crosses ports. Permit only its top-level public shell navigation;
  // API requests and subresources retain the same-origin Fetch Metadata check.
  const shellNavigation = req.method === 'GET' && req.url === '/' && req.headers['sec-fetch-site'] === 'same-site'
    && req.headers['sec-fetch-mode'] === 'navigate' && req.headers['sec-fetch-dest'] === 'document';
  return req.headers.host === new URL(origin).host && (!req.headers.origin || req.headers.origin === origin)
    && (!req.headers['sec-fetch-site'] || ['same-origin', 'none'].includes(req.headers['sec-fetch-site']) || shellNavigation);
}

function headers(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}
function reject(res, status, message) {
  if (res.headersSent) { res.destroy(); return; }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: message }));
}
function requestURL(req, res, origin) {
  headers(res);
  if (!protectedRequest(req, origin)) { reject(res, 403, 'Use the selected Atlas origin. Cross-origin access is not allowed.'); return null; }
  if (req.headers.upgrade || /(?:^|,)\s*upgrade\s*(?:,|$)/i.test(req.headers.connection ?? '')) { reject(res, 403, 'Connection upgrades are not supported.'); return null; }
  // Only origin-form paths reach the fixed upstream or selected export.
  if (!req.url.startsWith('/') || req.url.startsWith('//') || req.url.includes('\\')) { reject(res, 400, 'Invalid request path.'); return null; }
  try {
    const url = new URL(req.url, origin);
    if (url.origin !== origin) throw new Error();
    return url;
  } catch { reject(res, 400, 'Invalid request path.'); return null; }
}
async function listen(server, port, bind) {
  server.on('upgrade', (_req, socket) => socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'));
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, bind, resolve); });
  return server;
}
async function closeServer(server) {
  if (!server) return;
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
}

/** Authorize the external browser origin before translating to Atlas's loopback origin. */
export async function startAtlasGateway({ origin, upstream, port = 4721, bind = '0.0.0.0' }) {
  browserOrigin(origin, 'ATLAS_ORIGIN');
  const target = new URL(upstream);
  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || !target.port || target.username || target.password || target.pathname !== '/' || target.search || target.hash) throw new Error('Atlas upstream must be an exact loopback HTTP origin.');
  return listen(http.createServer((req, res) => {
    const url = requestURL(req, res, origin);
    if (!url) { req.resume(); return; }
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) { req.resume(); return reject(res, 405, 'This Atlas service supports GET, POST and DELETE.'); }
    const limit = 8 * 1024 * 1024;
    let bytes = 0, failed = false, outgoing;
    const fail = (status, message) => { if (failed) return; failed = true; outgoing?.destroy(); req.resume(); if (!res.headersSent) res.setHeader('Connection', 'close'); reject(res, status, message); };
    if (Number(req.headers['content-length'] ?? 0) > limit) return fail(413, 'Atlas request exceeds 8 MiB.');
    const forwarded = { ...req.headers, host: target.host };
    if (req.headers.origin) forwarded.origin = target.origin;
    for (const name of ['connection', 'keep-alive', 'proxy-authorization', 'proxy-authenticate', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'forwarded', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-for']) delete forwarded[name];
    // Authorization is supplied by the caller. The gateway never inserts Atlas's token.
    outgoing = http.request({ hostname: target.hostname, port: target.port, method: req.method, path: `${url.pathname}${url.search}`, headers: forwarded }, response => {
      if (failed) { response.destroy(); return; }
      res.writeHead(response.statusCode, response.headers);
      response.on('error', () => res.destroy());
      response.pipe(res);
    });
    outgoing.setTimeout(30000, () => fail(504, 'Atlas did not respond within the service timeout.'));
    outgoing.on('error', () => fail(502, 'Atlas is unavailable. Inspect the private service log.'));
    outgoing.on('drain', () => { if (!failed) req.resume(); });
    req.on('data', chunk => { if (failed) return; bytes += chunk.length; if (bytes > limit) return fail(413, 'Atlas request exceeds 8 MiB.'); if (!outgoing.write(chunk)) req.pause(); });
    req.on('end', () => { if (!failed) outgoing.end(); });
    req.on('aborted', () => outgoing.destroy());
    req.on('error', () => outgoing.destroy());
    res.on('close', () => { if (!res.writableFinished) outgoing.destroy(); });
  }), port, bind);
}

async function regularFile(root, relative, maxBytes) {
  const destination = path.join(root, relative);
  let current = root;
  for (const part of relative.split('/').slice(0, -1)) {
    current = path.join(current, part);
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe export directory.');
  }
  if (!inside(root, await realpath(destination))) throw new Error('Export path escaped its directory.');
  const handle = await open(destination, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.nlink !== 1 || info.size > maxBytes) throw new Error('Export file is not a bounded ordinary file.');
    const bytes = await handle.readFile();
    const current = await lstat(destination);
    if (current.isSymbolicLink() || current.dev !== info.dev || current.ino !== info.ino || current.size !== info.size || !inside(root, await realpath(destination))) throw new Error('Export changed during reading.');
    return bytes;
  } finally { await handle.close(); }
}

/** Preview only the current launch's explicit export, never a workspace or state tree. */
export async function startAtlasPreview({ origin, exportDirectory, exportRoot, port = 4722, bind = '0.0.0.0' }) {
  browserOrigin(origin, 'ATLAS_PREVIEW_ORIGIN');
  const root = await realpath(exportRoot);
  if (path.dirname(exportDirectory) !== root) throw new Error('Atlas preview must select one direct export directory.');
  return listen(http.createServer(async (req, res) => {
    const url = requestURL(req, res, origin);
    if (!url) return;
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    if (!['GET', 'HEAD'].includes(req.method)) { req.resume(); return reject(res, 405, 'Preview supports GET and HEAD.'); }
    let relative;
    try {
      const raw = decodeURIComponent(req.url.split('?')[0]);
      if (/[\\\x00-\x1f\x7f]/u.test(raw) || raw.split('/').some(part => part === '.' || part === '..')) throw new Error();
      relative = raw === '/' ? 'index.html' : raw.slice(1);
      if (!previewFiles.has(relative) && !/^sources\/[a-f0-9]{64}\.(?:txt|html)$/.test(relative)) throw new Error();
    } catch { return reject(res, 404, 'Export file not found.'); }
    try {
      const directoryInfo = await lstat(exportDirectory);
      if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink() || await realpath(exportDirectory) !== exportDirectory) throw new Error('Unsafe export directory.');
      const selection = JSON.parse((await regularFile(exportDirectory, 'selection.json', 4 * 1024 * 1024)).toString('utf8'));
      if (selection.format !== 'atlas.export-selection/1') throw new Error('No Atlas export.');
      if (!Array.isArray(selection.sources) || selection.sources.length > 10000) throw new Error('Invalid export source inventory.');
      const sourceFiles = new Map();
      for (const source of selection.sources.filter(source => source.status === 'ready')) {
        if (!/^sources\/[a-f0-9]{64}\.txt$/.test(source.path)) throw new Error('Invalid export source path.');
        sourceFiles.set(source.path, 'text/plain; charset=utf-8');
        if (source.htmlPath !== undefined) {
          if (source.htmlPath !== source.path.replace(/\.txt$/, '.html')) throw new Error('Invalid export source HTML path.');
          sourceFiles.set(source.htmlPath, 'text/html; charset=utf-8');
        }
      }
      if (!previewFiles.has(relative) && !sourceFiles.has(relative)) throw new Error('Export source is not selected.');
      for (const name of [...previewFiles.keys(), ...sourceFiles.keys()]) { const info = await lstat(path.join(exportDirectory, name)); if (!info.isFile() || info.isSymbolicLink()) throw new Error('Incomplete export.'); }
      const bytes = await regularFile(exportDirectory, relative, 32 * 1024 * 1024);
      if (sourceFiles.get(relative) === 'text/html; charset=utf-8') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
      res.writeHead(200, { 'Content-Type': previewFiles.get(relative) ?? sourceFiles.get(relative), 'Content-Length': bytes.length });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { reject(res, 404, 'No completed export is available at this path. Export a reviewed selection in Atlas first. Earlier exports remain in /exports/atlas-site.'); }
  }), port, bind);
}

/** The official CLI emits one bounded JSON object, which can span stdout chunks. */
export function atlasReadiness(child, { workspace, atlasPath, timeout = 30000 }) {
  return new Promise((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => fail(new Error('Atlas did not announce readiness before the startup timeout.')), timeout);
    const cleanup = () => { clearTimeout(timer); child.stdout.off('data', data); child.off('error', fail); child.off('close', closed); };
    const fail = error => { cleanup(); reject(error); };
    const closed = (code, signal) => fail(new Error(`Atlas exited before readiness (${signal ?? code}). Inspect its private service log.`));
    const data = chunk => {
      text += chunk;
      if (Buffer.byteLength(text) > 64 * 1024) return fail(new Error('Atlas readiness exceeded 64 KiB.'));
      let record;
      try { record = JSON.parse(text); } catch { return; }
      try {
        const url = new URL(record.url);
        const token = new URLSearchParams(url.hash.slice(1)).get('token');
        if (record.format !== 'atlas.server/1' || record.status !== 'serving' || record.editable !== true || record.project !== workspace || record.atlasPath !== atlasPath || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.pathname !== '/' || url.search || !/^[a-f0-9]{64}$/.test(token ?? '')) throw new Error();
        cleanup(); resolve({ record, upstream: url.origin, fragment: url.hash });
      } catch { fail(new Error('Atlas readiness does not match the selected project, collection and protected loopback service.')); }
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', data);
    child.once('error', fail);
    child.once('close', closed);
  });
}

export async function startAtlasService({ env = process.env, workspace = '/workspace', atlasPath = env.ATLAS_PATH ?? 'atlas', origin = env.ATLAS_ORIGIN ?? 'http://127.0.0.1:4721', previewOrigin = env.ATLAS_PREVIEW_ORIGIN ?? 'http://127.0.0.1:4722', port = 4721, previewPort = 4722, bind = '0.0.0.0', stateHome = '/state/atlas', exportRoot = '/exports/atlas-site', cli = '/opt/atlas/apps/cli/src/cli.mjs', executable = process.execPath, startupMilliseconds = 30000, shutdownMilliseconds = 5000, stderr = process.stderr, signal } = {}) {
  browserOrigin(origin, 'ATLAS_ORIGIN'); browserOrigin(previewOrigin, 'ATLAS_PREVIEW_ORIGIN');
  if (origin === previewOrigin) throw new Error('Atlas and its preview need separate origins.');
  const selected = await selectedAtlas(workspace, atlasPath);
  await mkdir(exportRoot, { recursive: true, mode: 0o700 });
  if ((await lstat(exportRoot)).isSymbolicLink()) throw new Error('Atlas exports require an ordinary directory.');
  exportRoot = await realpath(exportRoot);
  if (inside(selected.workspace, exportRoot) || inside(exportRoot, selected.workspace) || inside(path.resolve(stateHome), exportRoot) || inside(exportRoot, path.resolve(stateHome))) throw new Error('Atlas exports must be separate from the workspace and private state.');
  const exportDirectory = path.join(exportRoot, `export-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`);
  signal?.throwIfAborted();
  const child = spawn(executable, [cli, 'open', selected.workspace, '--atlas', selected.atlasPath, '--no-browser', '--port', '0', '--state-home', stateHome, '--export-directory', exportDirectory], { cwd: selected.workspace, env: { ...env, ATLAS_STATE_HOME: stateHome }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr.pipe(stderr, { end: false });
  let gateway, preview, stopped = false, exited = false, closePromise, finish;
  const closed = new Promise(resolve => { finish = resolve; });
  const childClosed = new Promise(resolve => child.once('close', () => { exited = true; resolve(); }));
  const close = (nativeSignal = 'SIGTERM', code = 0) => {
    if (closePromise) return closePromise;
    stopped = true;
    closePromise = (async () => {
      const cutoff = setTimeout(() => { if (!exited) child.kill('SIGKILL'); }, shutdownMilliseconds);
      if (!exited) child.kill(nativeSignal);
      await Promise.all([closeServer(gateway), closeServer(preview), childClosed]);
      clearTimeout(cutoff); signal?.removeEventListener('abort', abort); finish(code);
    })();
    return closePromise;
  };
  const abort = () => void close('SIGTERM');
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const ready = await atlasReadiness(child, { workspace: selected.workspace, atlasPath: selected.atlasPath, timeout: startupMilliseconds });
    if (stopped || exited) throw new Error('Atlas stopped before its gateway opened.');
    gateway = await startAtlasGateway({ origin, upstream: ready.upstream, port, bind });
    if (stopped || exited) throw new Error('Atlas stopped while its gateway was opening.');
    preview = await startAtlasPreview({ origin: previewOrigin, exportDirectory, exportRoot, port: previewPort, bind });
    if (exited || stopped) throw new Error('Atlas exited while its gateway was starting.');
    child.once('close', (code, signal) => { if (!stopped) { stderr.write(`Atlas service exited (${signal ?? code}).\n`); void close('SIGTERM', 1); } });
    child.stdout.on('data', () => {});
    return { gateway, preview, exportDirectory, url: `${origin}/${ready.fragment}`, selected, close, closed };
  } catch (error) {
    await close('SIGTERM', 1);
    // Cancellation can race with a pending listen, before its server is assigned.
    await Promise.all([closeServer(gateway), closeServer(preview)]);
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let service;
  const controller = new AbortController();
  const signals = Object.fromEntries(['SIGTERM', 'SIGINT'].map(signal => [signal, () => controller.abort()]));
  for (const [signal, handler] of Object.entries(signals)) process.on(signal, handler);
  try {
    service = await startAtlasService({ signal: controller.signal });
    console.log(`Open: ${service.url}`);
    console.log(`Ready: ${JSON.stringify({ event: 'atlas.ready', origin: new URL(service.url).origin, repositoryRoot: service.selected.workspace, atlasPath: service.selected.atlasPath })}`);
    console.log(`Atlas export destination: ${service.exportDirectory}`);
    process.exitCode = await service.closed;
  } catch (error) { if (!controller.signal.aborted) console.error(`Atlas service failed: ${error.message}`); process.exitCode = controller.signal.aborted ? 0 : 1; }
  finally { for (const [signal, handler] of Object.entries(signals)) process.removeListener(signal, handler); }
}
