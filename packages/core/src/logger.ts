/**
 * Tiny structured logger.
 *
 * - Console writes go through chalk for colour.
 * - Persistent appender writes JSON lines to ~/.lighthouse/lighthouse.log.
 * - We deliberately avoid Pino/Winston: this app is single-user CLI, dependency
 *   weight is not worth it.
 */
import { appendFileSync } from 'node:fs';
import chalk from 'chalk';
import { config, ensureHome } from './config.js';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: Level = config.debug ? 'debug' : 'info';

function fmt(level: Level, scope: string, msg: string): string {
  const ts = new Date().toISOString();
  const tag = (
    {
      debug: chalk.gray('DEBUG'),
      info: chalk.blue('INFO '),
      warn: chalk.yellow('WARN '),
      error: chalk.red('ERROR'),
    } as const
  )[level];
  return `${chalk.gray(ts)} ${tag} ${chalk.cyan(scope.padEnd(14))} ${msg}`;
}

function persist(level: Level, scope: string, msg: string, meta?: unknown): void {
  try {
    ensureHome();
    const line = JSON.stringify({ ts: new Date().toISOString(), level, scope, msg, meta }) + '\n';
    appendFileSync(config.logPath, line, { mode: 0o600 });
  } catch {
    // Logging must never throw. Swallow.
  }
}

export interface Logger {
  debug(msg: string, meta?: unknown): void;
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  child(scope: string): Logger;
}

export function makeLogger(scope = 'lighthouse'): Logger {
  function emit(level: Level, msg: string, meta?: unknown): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[MIN_LEVEL]) return;
    // eslint-disable-next-line no-console
    (level === 'error' || level === 'warn' ? console.error : console.log)(fmt(level, scope, msg));
    if (meta !== undefined && config.debug) {
      // eslint-disable-next-line no-console
      console.log(chalk.gray(JSON.stringify(meta)));
    }
    persist(level, scope, msg, meta);
  }
  return {
    debug: (m, meta) => emit('debug', m, meta),
    info: (m, meta) => emit('info', m, meta),
    warn: (m, meta) => emit('warn', m, meta),
    error: (m, meta) => emit('error', m, meta),
    child: (s) => makeLogger(`${scope}:${s}`),
  };
}

export const log = makeLogger();
