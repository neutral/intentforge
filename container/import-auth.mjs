import { lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function importAuth(input, home = '/state/codex') {
  const chunks = []; let size = 0;
  for await (const chunk of input) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error('Authentication file exceeds 1 MiB.');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  let value;
  try { value = JSON.parse(bytes); } catch { throw new Error('Authentication file is not valid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !(typeof value.OPENAI_API_KEY === 'string' && value.OPENAI_API_KEY.trim()) &&
      !(typeof value.tokens?.access_token === 'string' && value.tokens.access_token && typeof value.tokens?.refresh_token === 'string' && value.tokens.refresh_token)) {
    throw new Error('Authentication file contains no supported Codex credentials.');
  }
  await mkdir(home, { recursive: true, mode: 0o700 });
  if ((await lstat(home)).isSymbolicLink()) throw new Error('Private Codex home must be an ordinary directory.');
  const destination = path.join(home, 'auth.json');
  const existing = await lstat(destination).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (existing && !existing.isFile()) throw new Error('Existing authentication must be an ordinary file.');
  const temporary = path.join(home, `.auth-import-${randomUUID()}`);
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(bytes); await file.sync(); await file.close();
    await rename(temporary, destination);
  } finally { await file.close(); await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await importAuth(process.stdin); console.log('Authentication copied to private container state.'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
