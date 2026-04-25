/**
 * Centralized runtime config for Lighthouse.
 *
 * Loads from environment variables (.env via dotenv) and computes derived
 * paths. All file system locations live under LIGHTHOUSE_HOME (default
 * ~/.lighthouse). Config is read once at import time and frozen.
 */
import { config as loadDotenv } from 'dotenv';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

loadDotenv();

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envStr(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function envBool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v == null) return fallback;
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

const LIGHTHOUSE_HOME = resolve(envStr('LIGHTHOUSE_HOME') || join(homedir(), '.lighthouse'));

export const config = Object.freeze({
  home: LIGHTHOUSE_HOME,
  dbPath: join(LIGHTHOUSE_HOME, 'lighthouse.db'),
  logPath: join(LIGHTHOUSE_HOME, 'lighthouse.log'),
  webDistPath: resolve(process.cwd(), 'apps/web/dist'),

  google: {
    clientId: envStr('GOOGLE_CLIENT_ID'),
    clientSecret: envStr('GOOGLE_CLIENT_SECRET'),
  },

  llm: {
    provider: (envStr('LLM_PROVIDER', 'anthropic') as 'anthropic' | 'ollama'),
    anthropic: {
      apiKey: envStr('ANTHROPIC_API_KEY'),
      model: envStr('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001'),
    },
    ollama: {
      baseUrl: envStr('OLLAMA_BASE_URL', 'http://localhost:11434'),
      model: envStr('OLLAMA_MODEL', 'llama3.1:8b'),
    },
    concurrency: envInt('LLM_CONCURRENCY', 5),
  },

  sync: {
    daysBack: envInt('SYNC_DAYS_BACK', 730),
  },

  api: {
    host: envStr('API_HOST', '127.0.0.1'),
    port: envInt('API_PORT', 5174),
  },
  webPort: envInt('WEB_PORT', 5173),

  debug: envBool('LIGHTHOUSE_DEBUG'),
});

export function ensureHome(): void {
  if (!existsSync(config.home)) {
    mkdirSync(config.home, { recursive: true, mode: 0o700 });
  }
}
