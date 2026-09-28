import { spawn } from 'node:child_process';
import { chmod, lstat, mkdir, open, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pluginFromList, readTrellisPackage, verifyInstalledTrellis } from './codex-plugins.mjs';

// Forge 0.1.0 requests plus IntentForge's local plugin discovery calls.
const initialize = { clientInfo: { name: 'forge', version: '0.1.0' }, capabilities: { experimentalApi: true } };
const input = [{ type: 'text', text: 'Compatibility schema inspection only.', text_elements: [] }];
const requests = {
  initialize: [initialize],
  'thread/start': [{}, { cwd: '/probe', model: 'probe-model', sandbox: 'read-only', approvalPolicy: 'never' }],
  'thread/resume': [{ threadId: 'probe-thread' }, { threadId: 'probe-thread', model: 'probe-model', sandbox: 'read-only', approvalPolicy: 'never' }],
  'thread/read': [{ threadId: 'probe-thread', includeTurns: true }],
  'turn/start': [{ threadId: 'probe-thread', input }],
  'turn/steer': [{ threadId: 'probe-thread', expectedTurnId: 'probe-turn', input }],
  'turn/interrupt': [{ threadId: 'probe-thread', turnId: 'probe-turn' }],
  'plugin/installed': [{ cwds: ['/probe'] }],
  'skills/list': [{ cwds: ['/probe'], forceReload: true }],
};
const failure = message => new Error(`Codex compatibility probe: ${message}`);
const cleanupFailure = message => Object.assign(failure(message), { code: 'CODEX_PROBE_CLEANUP_FAILED' });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function resolve(schema, document, depth = 0) {
  if (depth > 40 || !object(schema)) throw failure('unsupported protocol schema');
  if (!schema.$ref) return schema;
  if (!/^#\/(?:definitions|\$defs)\/[A-Za-z0-9_]+$/.test(schema.$ref)) throw failure('unsupported protocol schema reference');
  const [, collection, name] = schema.$ref.split('/');
  return resolve(document[collection]?.[name], document, depth + 1);
}

// Check the concrete values Forge sends, including newly required fields and
// removed properties. This deliberately does not claim full JSON Schema support.
function accepts(schema, value, document, depth = 0, unknownProperties = false) {
  if (schema === true) return true;
  if (schema === false || depth > 40) return false;
  schema = resolve(schema, document);
  if (['not', 'if', 'then', 'else', 'patternProperties', 'dependentSchemas', 'dependentRequired'].some(key => key in schema)) return false;
  if (schema.allOf && !schema.allOf.every(item => accepts(item, value, document, depth + 1, unknownProperties))) return false;
  if (schema.anyOf && !schema.anyOf.some(item => accepts(item, value, document, depth + 1, unknownProperties))) return false;
  if (schema.oneOf && schema.oneOf.filter(item => accepts(item, value, document, depth + 1, unknownProperties)).length !== 1) return false;
  if ('const' in schema && JSON.stringify(schema.const) !== JSON.stringify(value)) return false;
  if (schema.enum && !schema.enum.some(item => JSON.stringify(item) === JSON.stringify(value))) return false;
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (schema.type && ![].concat(schema.type).some(item => item === type || item === 'integer' && Number.isInteger(value))) return false;
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength || schema.maxLength !== undefined && value.length > schema.maxLength) return false;
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) return false;
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems || schema.maxItems !== undefined && value.length > schema.maxItems) return false;
    if (schema.items && !value.every(item => accepts(schema.items, item, document, depth + 1, unknownProperties))) return false;
  }
  if (object(value)) {
    if ((schema.required ?? []).some(key => !(key in value))) return false;
    if (schema.properties) for (const [key, item] of Object.entries(value)) {
      if (!(key in schema.properties)) { if (!unknownProperties || schema.additionalProperties === false) return false; }
      else if (!accepts(schema.properties[key], item, document, depth + 1, unknownProperties)) return false;
    }
  }
  return true;
}

function property(schema, key, document) {
  schema = resolve(schema, document);
  if (schema.type !== 'object' || !schema.required?.includes(key) || !schema.properties?.[key]) throw failure(`missing required response field ${key}`);
  return resolve(schema.properties[key], document);
}

async function schemaFile(directory, filename) {
  const filenamePath = path.join(directory, filename);
  const info = await lstat(filenamePath);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 8 * 1024 * 1024) throw failure('invalid generated schema file');
  try { return JSON.parse(await readFile(filenamePath, 'utf8')); }
  catch { throw failure('invalid generated schema JSON'); }
}

async function checkSchemas(directory) {
  const document = await schemaFile(directory, 'ClientRequest.json');
  for (const [method, samples] of Object.entries(requests)) {
    const shape = document.oneOf?.find(item => item.properties?.method?.enum?.includes(method) || item.properties?.method?.const === method);
    if (!shape || !samples.every(params => accepts(shape, { id: 1, method, params }, document))) throw failure(`incompatible request schema for ${method}`);
  }
  const notifications = await schemaFile(directory, 'ClientNotification.json');
  if (!accepts(notifications, { method: 'initialized', params: {} }, notifications, 0, true)) throw failure('incompatible initialized notification schema');
  for (const name of ['ThreadStartResponse', 'ThreadResumeResponse', 'ThreadReadResponse']) {
    const response = await schemaFile(directory, `v2/${name}.json`);
    const thread = property(response, 'thread', response);
    if (property(thread, 'id', response).type !== 'string') throw failure('incompatible thread identity schema');
    const turns = property(thread, 'turns', response);
    if (turns.type !== 'array') throw failure('incompatible thread turns schema');
    const turn = resolve(turns.items, response);
    if (property(turn, 'id', response).type !== 'string' || !accepts(property(turn, 'status', response), 'inProgress', response)) throw failure('incompatible active turn schema');
  }
  const start = await schemaFile(directory, 'v2/TurnStartResponse.json');
  if (property(property(start, 'turn', start), 'id', start).type !== 'string') throw failure('incompatible turn identity schema');
  const steer = await schemaFile(directory, 'v2/TurnSteerResponse.json');
  if (property(steer, 'turnId', steer).type !== 'string') throw failure('incompatible steer response schema');
  const interrupt = await schemaFile(directory, 'v2/TurnInterruptResponse.json');
  if (resolve(interrupt, interrupt).type !== 'object') throw failure('incompatible interrupt response schema');
  return {
    initialize: await schemaFile(directory, 'v1/InitializeResponse.json'),
    plugins: await schemaFile(directory, 'v2/PluginInstalledResponse.json'),
    skills: await schemaFile(directory, 'v2/SkillsListResponse.json'),
  };
}

/** Check an installed npm Codex entry without loading user state or invoking a model. */
export async function probeCodex({ command, version, directory, timeoutMilliseconds = 15000, signal, pluginRoot = '/opt/intentforge/plugins/trellis' } = {}) {
  if (!path.isAbsolute(command ?? '') || !path.isAbsolute(directory ?? '') || !/^\d+\.\d+\.\d+$/.test(version ?? '')) throw failure('an absolute command, private directory and stable version are required');
  if (!Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds < 1 || timeoutMilliseconds > 120000) throw failure('invalid timeout');
  const control = new AbortController();
  const abort = () => control.abort(failure('cancelled'));
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(() => control.abort(failure('timed out')), timeoutMilliseconds);
  const children = new Set();
  let socket, log, bytes = 0;
  const check = () => { if (control.signal.aborted) throw control.signal.reason; };
  const kill = (child, value) => { if (child.pid) try { process.kill(-child.pid, value); } catch (error) { if (error.code !== 'ESRCH') child.kill(value); } };
  const stop = async child => {
    kill(child, 'SIGTERM');
    await Promise.race([child.finished, delay(250)]);
    kill(child, 'SIGKILL');
    await Promise.race([child.finished, delay(750)]);
    // The npm shim can exit before its native child. Wait for that process group,
    // rather than treating the shim's exit as proof that the server stopped.
    for (let attempt = 0; child.pid && attempt < 50; attempt++) {
      try { process.kill(-child.pid, 0); }
      catch (error) { if (error.code === 'ESRCH') break; throw cleanupFailure('cannot inspect attempted process shutdown'); }
      if (attempt === 49) throw cleanupFailure('attempted process group did not stop');
      await delay(10);
    }
    children.delete(child);
  };
  try {
    check();
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || (await readdir(directory)).length) throw failure('probe directory must be an empty private directory');
    await chmod(directory, 0o700);
    const paths = Object.fromEntries(['home', 'codex', 'installation', 'workspace', 'tmp', 'schema'].map(name => [name, path.join(directory, name)]));
    for (const pathname of Object.values(paths)) await mkdir(pathname, { mode: 0o700 });
    log = await open(path.join(directory, 'probe.log'), 'wx', 0o600);
    const env = { HOME: paths.home, CODEX_HOME: paths.codex, XDG_CONFIG_HOME: path.join(paths.home, '.config'), TMPDIR: paths.tmp, PATH: `${path.dirname(process.execPath)}:/usr/local/bin:/usr/bin:/bin`, LANG: 'C.UTF-8', TERM: 'dumb', NO_COLOR: '1', RUST_LOG: 'error' };
    const launch = (args, codexHome = paths.codex) => {
      check();
      const child = spawn(process.execPath, [command, ...args], { cwd: paths.workspace, env: { ...env, CODEX_HOME: codexHome }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
      children.add(child);
      child.output = '';
      child.stdoutOutput = '';
      child.finished = new Promise(resolve => { child.once('error', () => resolve({ error: true })); child.once('close', (code, exitSignal) => resolve({ code, signal: exitSignal })); });
      for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
        if (bytes + chunk.length > 64 * 1024) { control.abort(failure('diagnostic output limit exceeded')); return; }
        bytes += chunk.length;
        child.output += chunk.toString('utf8');
        if (stream === child.stdout) child.stdoutOutput += chunk.toString('utf8');
        // One shared descriptor and a bounded total keep diagnostics private and small.
        void log.write(chunk).catch(() => control.abort(failure('cannot retain probe diagnostics')));
      });
      return child;
    };
    const wait = promise => new Promise((resolve, reject) => {
      const interrupted = () => reject(control.signal.reason);
      control.signal.addEventListener('abort', interrupted, { once: true });
      if (control.signal.aborted) interrupted();
      promise.then(resolve, reject).finally(() => control.signal.removeEventListener('abort', interrupted));
    });
    const run = async (args, label, codexHome = paths.codex) => {
      const child = launch(args, codexHome);
      try {
        const result = await wait(child.finished);
        if (result.error || result.code !== 0) throw failure(`${label} failed`);
        check();
        return child.stdoutOutput;
      } finally { await stop(child); }
    };
    if ((await run(['--version'], 'version command')).trim() !== `codex-cli ${version}`) throw failure('installed version does not match the selected release');
    await run(['app-server', 'generate-json-schema', '--out', paths.schema], 'schema generation');
    check();
    const schemas = await checkSchemas(paths.schema);
    const trellis = await readTrellisPackage(pluginRoot);
    const installedPath = path.join(paths.codex, 'plugins/cache/intentforge/trellis', trellis.version);
    const preparedPath = path.join(paths.installation, 'plugins/cache/intentforge/trellis', trellis.version);
    const installed = JSON.parse(await run(['plugin', 'add', trellis.pluginId, '--json'], 'Trellis installation', paths.installation));
    if (installed.pluginId !== trellis.pluginId || installed.name !== 'trellis' || installed.marketplaceName !== 'intentforge' || installed.version !== trellis.version || installed.installedPath !== preparedPath) throw failure('incompatible Trellis installation result');
    if (!(await realpath(preparedPath)).startsWith(`${await realpath(paths.installation)}${path.sep}`)) throw failure('Trellis installation escapes isolated state');
    await verifyInstalledTrellis(preparedPath, trellis);
    check();
    // Match startup: promote only package files, without native installation
    // metadata or configuration, then require discovery in the receiving home.
    await mkdir(path.dirname(installedPath), { recursive: true, mode: 0o700 });
    await rename(preparedPath, installedPath);
    const listed = pluginFromList(await run(['plugin', 'list', '--json'], 'Trellis listing'), trellis, installedPath);
    if (!listed || listed.enabled !== true) throw failure('Trellis is not enabled in the isolated installation');
    check();
    const server = launch(['app-server', '--listen', 'ws://127.0.0.1:0']);
    let address;
    const exited = server.finished.then(() => { throw failure('app-server exited before initialization'); });
    // The native server announces the bound ephemeral address on its diagnostic stream.
    while (!(address = server.output.match(/listening on:\s*(ws:\/\/127\.0\.0\.1:(\d+))/))) {
      await wait(Promise.race([delay(20), exited]));
    }
    if (+address[2] < 1 || +address[2] > 65535) throw failure('invalid app-server listening address');
    socket = new WebSocket(address[1]);
    await wait(Promise.race([exited, new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(failure('WebSocket connection failed')), { once: true });
    })]));
    let sequence = 0, pending, receivedBytes = 0;
    const protocolFailure = message => control.abort(failure(message));
    socket.addEventListener('close', () => protocolFailure('WebSocket closed during protocol inspection'));
    socket.addEventListener('error', () => protocolFailure('WebSocket protocol inspection failed'));
    socket.addEventListener('message', event => {
      if (typeof event.data !== 'string') return protocolFailure('invalid protocol response');
      receivedBytes += Buffer.byteLength(event.data);
      if (receivedBytes > 256 * 1024) return protocolFailure('protocol response limit exceeded');
      let message;
      try { message = JSON.parse(event.data); } catch { return protocolFailure('invalid protocol JSON'); }
      if (!object(message)) return protocolFailure('invalid protocol response');
      if (typeof message.method === 'string' && message.id === undefined) return;
      if (!pending || message.id !== pending.id || message.method || message.error || !object(message.result)) return protocolFailure('incompatible protocol response');
      const current = pending;
      pending = undefined;
      current.resolve(message.result);
    });
    const request = (method, params) => {
      check();
      if (pending) throw failure('overlapping protocol inspection requests');
      const id = ++sequence;
      return wait(Promise.race([exited, new Promise(resolve => {
        pending = { id, resolve };
        socket.send(JSON.stringify({ id, method, params }));
      })]));
    };
    const result = await request('initialize', initialize);
    if (!accepts(schemas.initialize, result, schemas.initialize) || typeof result.userAgent !== 'string' || !result.userAgent) throw failure('initialization result does not match its schema');
    socket.send(JSON.stringify({ method: 'initialized', params: {} }));
    const plugins = await request('plugin/installed', { cwds: [paths.workspace] });
    if (!accepts(schemas.plugins, plugins, schemas.plugins, 0, true) || !Array.isArray(plugins.marketplaces) || plugins.marketplaceLoadErrors?.length) throw failure('incompatible installed plugin discovery');
    const marketplaces = plugins.marketplaces.filter(item => item.name === 'intentforge');
    const discovered = marketplaces.length === 1 && marketplaces[0].plugins?.filter(item => item.id === trellis.pluginId);
    if (!discovered || discovered.length !== 1 || discovered[0].name !== 'trellis' || discovered[0].installed !== true || discovered[0].enabled !== true || discovered[0].localVersion !== trellis.version || discovered[0].source?.type !== 'local' || discovered[0].source.path !== trellis.root) throw failure('app-server did not discover the pinned enabled Trellis plugin');
    const skills = await request('skills/list', { cwds: [paths.workspace], forceReload: true });
    if (!accepts(schemas.skills, skills, schemas.skills, 0, true) || skills.data?.length !== 1 || skills.data[0].cwd !== paths.workspace || skills.data[0].errors?.length || !Array.isArray(skills.data[0].skills)) throw failure('incompatible Trellis skill discovery');
    const discoveredSkills = skills.data[0].skills.filter(item => item.pluginId === trellis.pluginId);
    if (discoveredSkills.length !== trellis.skills.length || trellis.skills.some(name => {
      const matches = discoveredSkills.filter(item => item.name === `trellis:${name}`);
      return matches.length !== 1 || matches[0].enabled !== true || matches[0].path !== path.join(installedPath, 'skills', name, 'SKILL.md');
    })) throw failure('app-server did not discover both pinned enabled Trellis skills');
    await verifyInstalledTrellis(installedPath, trellis);
    check();
    const report = { version, status: 'compatible', methods: Object.keys(requests), checks: ['exact-version', 'forge-request-schemas', 'forge-response-schemas', 'websocket-initialize', 'trellis-installation', 'trellis-cache-promotion', 'trellis-plugin-discovery', 'trellis-skill-discovery', 'trellis-package-bytes'], trellis: { pluginId: trellis.pluginId, version: trellis.version, skills: trellis.skills }, scope: 'Isolated startup, protocol and bundled plugin discovery checks; no authentication, thread, turn or model request.' };
    await writeFile(path.join(directory, 'probe.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return report;
  } catch (error) {
    if (control.signal.aborted) throw control.signal.reason;
    if (error.message?.startsWith('Codex compatibility probe:')) throw error;
    throw failure('installation or protocol inspection failed');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    socket?.close();
    try { await Promise.all([...children].map(stop)); }
    finally { await log?.close(); }
  }
}
