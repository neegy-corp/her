import { projectRoot } from './sites-env.mjs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const cli = path.join(projectRoot, 'node_modules/wrangler/bin/wrangler.js');
const args = [cli, 'dev', '--config', path.join(projectRoot, 'dist/server/wrangler.json'),
  '--env-file', path.join(projectRoot, '.env'), '--env-file', path.join(projectRoot, '.env.local'),
  '--local', '--persist-to', path.join(projectRoot, '.wrangler/state'), '--ip', '127.0.0.1',
  '--port', '5180', '--inspector-port', '0', ...process.argv.slice(2)];
const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
