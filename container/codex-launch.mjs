import { readFile, realpath, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Selection happens before service startup. Every Codex invocation uses that choice.
export async function selectedCommand(root = '/state/tools/codex', bundled = '/opt/codex/bin/codex.js', selectionFile = '/run/intentforge/codex-selection.json') {
  const selected = JSON.parse(await readFile(selectionFile, 'utf8'));
  if (selected.schema !== 'intentforge.codex-selection/1' || !['installed', 'cached', 'bundled'].includes(selected.source)) throw new Error('Invalid Codex selection metadata.');
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(selected.version ?? '')) throw new Error('Invalid selected Codex version.');
  const relative = typeof selected.command === 'string' ? path.relative(path.join(root, 'versions', selected.version), selected.command) : '';
  if (selected.source !== 'bundled' && !/^[a-zA-Z0-9-]+\/node_modules\/@openai\/codex\/bin\/codex\.js$/.test(relative)) throw new Error('Invalid selected Codex installation path.');
  const expected = selected.source === 'bundled' ? bundled : selected.command;
  if (selected.command !== expected || !(await stat(expected)).isFile()) throw new Error('The selected Codex installation is unavailable.');
  const resolved = await realpath(expected), base = await realpath(selected.source === 'bundled' ? path.dirname(bundled) : path.join(root, 'versions', selected.version));
  if (!resolved.startsWith(`${base}${path.sep}`)) throw new Error('The selected Codex command escapes its installation.');
  return expected;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const command = await selectedCommand();
    const child = spawn(process.execPath, [command, ...process.argv.slice(2)], { stdio: 'inherit' });
    const handlers = Object.fromEntries(['SIGINT', 'SIGTERM', 'SIGHUP'].map(signal => [signal, () => child.kill(signal)]));
    for (const [signal, handler] of Object.entries(handlers)) process.on(signal, handler);
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
    for (const [signal, handler] of Object.entries(handlers)) process.off(signal, handler);
    process.exitCode = result.code ?? (result.signal === 'SIGINT' ? 130 : 143);
  } catch (error) {
    console.error(`Codex unavailable: ${error.message} Wait for startup selection or inspect the container log.`);
    process.exitCode = 1;
  }
}
