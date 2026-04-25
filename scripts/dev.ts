/**
 * `npm run dev` — start API and dashboard concurrently.
 *
 * For dev convenience, we expect `LIGHTHOUSE_PASSPHRASE` in env so the API
 * doesn't hang on the passphrase prompt every time tsx-watch restarts. If
 * it's missing we print a helpful message with the suggested invocation.
 */
import { spawn } from 'node:child_process';

if (!process.env.LIGHTHOUSE_PASSPHRASE) {
  console.error(
    '\n\x1b[33m!\x1b[0m LIGHTHOUSE_PASSPHRASE is not set.\n' +
    '  In dev, the API restarts on every code change and would otherwise\n' +
    '  prompt for your passphrase each time. Either:\n' +
    '    LIGHTHOUSE_PASSPHRASE=your-pass npm run dev\n' +
    '  or, in two terminals: `npm run serve` and `npm run dev:web`.\n',
  );
  process.exit(1);
}

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
