import { readFile, mkdir, open, rename, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { config, initialState, tick } from './paper-engine.mjs';
import { market } from './paper-market.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const runtime = resolve(root, '.sites-runtime', 'paper-trader');
const once = process.argv.includes('--once');
await mkdir(runtime, { recursive: true });
// Read only this isolated quote credential file; never load the site/studio .env.
const local = parseEnv(await readFile(resolve(runtime, 'quotes.env'), 'utf8'));
if (Object.keys(local).some(key => key !== 'JUPITER_API_KEY')) throw new Error('Paper credential file may contain only JUPITER_API_KEY.');
const settings = config(JSON.parse(await readFile(resolve(runtime, 'config.json'), 'utf8')));
const statePath = resolve(runtime, 'state.json');
const lockPath = resolve(runtime, 'worker.lock');
let lock;
try { lock = await open(lockPath, 'wx'); }
catch { throw new Error('Paper worker already running, or a stale lock needs operator inspection.'); }
await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: Date.now() }));
await lock.close();
let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
async function persist(state) {
  const temporary = `${statePath}.tmp`;
  const handle = await open(temporary, 'w');
  try { await handle.writeFile(JSON.stringify(state, null, 2)); await handle.sync(); }
  finally { await handle.close(); }
  await rename(temporary, statePath);
}
try {
  let state;
  try { state = JSON.parse(await readFile(statePath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Paper journal unreadable; refusing to reset.'); state = initialState(settings, Date.now()); }
  let excluded = [];
  try {
    const active = JSON.parse(await readFile(resolve(root, '..', 'her', 'public', 'active-stream.json'), 'utf8'));
    excluded = [active.mint, active.coinMint, active.tokenMint].filter(Boolean);
    for (const value of Object.values(active)) {
      if (typeof value === 'string') { const match = value.match(/pump\.fun\/coin\/([1-9A-HJ-NP-Za-km-z]{32,44})/); if (match) excluded.push(match[1]); }
    }
  } catch { /* Paper only. An unavailable studio file does not change its live coin. */ }
  const provider = market(local.JUPITER_API_KEY, excluded);
  do {
    state = await tick(state, settings, provider);
    await persist(state);
    console.log(JSON.stringify({ mode: 'paper', at: state.updatedAt, status: state.status, simulatedEvents: state.events.length }));
    if (once) break;
    for (let elapsed = 0; elapsed < 60 && !stopping; elapsed++) await new Promise(resolve => setTimeout(resolve, 1000));
  } while (!stopping);
} finally {
  await unlink(lockPath);
}
