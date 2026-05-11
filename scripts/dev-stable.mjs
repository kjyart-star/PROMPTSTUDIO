import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = process.env.PORT ?? '5173';

const isMac = process.platform === 'darwin';
const url = `http://${HOST}:${PORT}/`;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');

let didOpen = false;
let child = null;
let stopping = false;

const run = () => {
  const args = ['vite', '--host', HOST, '--port', PORT, '--strictPort'];
  child = spawn('./node_modules/.bin/vite', args, {
    stdio: 'inherit',
    env: { ...process.env },
    cwd: projectRoot,
    shell: false,
  });

  child.on('spawn', () => {
    if (didOpen) return;
    didOpen = true;
    if (!isMac) return;
    // Open once; user can keep this process alive to keep the server reachable.
    spawn('open', [url], { stdio: 'ignore' });
  });

  child.on('exit', (code, signal) => {
    child = null;
    if (stopping) return;
    const label = signal ? `signal ${signal}` : `exit ${code ?? 'unknown'}`;
    // eslint-disable-next-line no-console
    console.log(`[dev:stable] vite stopped (${label}). restarting in 0.8s...`);
    setTimeout(run, 800);
  });
};

const stop = () => {
  stopping = true;
  if (child) child.kill('SIGTERM');
  setTimeout(() => process.exit(0), 300);
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

run();
