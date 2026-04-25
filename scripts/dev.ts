/**
 * `npm run dev` — start API and dashboard concurrently.
 *
 * Uses `concurrently` so SIGINT propagates to both. We pass through the
 * passphrase via env (LIGHTHOUSE_PASSPHRASE) — convenience for development;
 * production setups should run `npm run serve` directly.
 */
import { spawn } from 'node:child_process';

const procs = [
  {
    name: 'api',
    color: 'cyan',
    cmd: 'npx',
    args: ['tsx', 'watch', 'apps/cli/src/index.ts', 'serve'],
  },
  {
    name: 'web',
    color: 'magenta',
    cmd: 'npx',
    args: ['vite', '--config', 'apps/web/vite.config.ts'],
  },
];

const colors: Record<string, string> = {
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
};

const children = procs.map((p) => {
  const child = spawn(p.cmd, p.args, { stdio: ['inherit', 'pipe', 'pipe'] });
  const tag = `${colors[p.color] ?? ''}[${p.name}]${colors.reset}`;
  child.stdout.on('data', (d: Buffer) => {
    process.stdout.write(`${tag} ${d.toString()}`);
  });
  child.stderr.on('data', (d: Buffer) => {
    process.stderr.write(`${tag} ${d.toString()}`);
  });
  child.on('exit', (code) => {
    process.stderr.write(`${tag} exited ${code}\n`);
    process.exit(code ?? 1);
  });
  return child;
});

const stop = (): void => {
  for (const c of children) c.kill('SIGINT');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
