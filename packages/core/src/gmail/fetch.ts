/**
 * Incremental Gmail fetcher.
 *
 * - First sync: list messages with `after:<unix-timestamp-of-N-days-ago>`.
 * - Subsequent: list messages with `after:<last-cursor>` (a Gmail-friendly
 *   `after:` epoch). We then dedupe by gmail_message_id at insert time.
 * - We fan out full-message fetches with concurrency 5 to stay polite.
 * - Exponential backoff with jitter on 429/5xx.
 */
import type { gmail_v1 } from 'googleapis';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import { config } from '../config.js';
import { kvGet, kvSet, KV_KEYS } from '../db/kv.js';
import { insertEmail } from '../db/queries.js';
import { parseGmailMessage } from './parse.js';
import { log } from '../logger.js';

const PER_PAGE = 500; // Gmail max for messages.list

/** Sleep with jitter. Used by retry. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Retry a network op with exponential backoff. Bails on non-retryable errors. */
async function withRetry<T>(fn: () => Promise<T>, what: string, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e: unknown) {
      last = e;
      const status = (e as { code?: number; response?: { status?: number } })?.code
        ?? (e as { response?: { status?: number } })?.response?.status;
      const retryable = status === 429 || (typeof status === 'number' && status >= 500);
      if (!retryable || i === attempts - 1) break;
      const wait = 500 * Math.pow(2, i) + Math.floor(Math.random() * 250);
      log.warn(`${what} failed (status ${status}); retrying in ${wait}ms (${i + 1}/${attempts})`);
      await sleep(wait);
    }
  }
  throw last;
}

function buildQuery(): string {
  // Either pick up where we left off, or start at SYNC_DAYS_BACK.
  const cursor = kvGet(KV_KEYS.syncCursor);
  if (cursor) {
    // Cursor stored as ms; Gmail `after:` wants seconds. Subtract 1 day to be safe
    // about Gmail's flaky internal-date ordering.
    const sec = Math.floor(Number.parseInt(cursor, 10) / 1000) - 86400;
    return `after:${sec}`;
  }
  return `newer_than:${config.sync.daysBack}d`;
}

interface FetchProgress {
  fetched: number;
  inserted: number;
  errors: number;
}

/** Walk the full message-id list; resolve once `cb` has been called for each id. */
async function listAllIds(
  gmail: gmail_v1.Gmail,
  query: string,
  cb: (id: string) => void,
): Promise<void> {
  let pageToken: string | undefined;
  do {
    const res = await withRetry(
      () =>
        gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: PER_PAGE,
          pageToken,
        }),
      'messages.list',
    );
    for (const m of res.data.messages ?? []) {
      if (m.id) cb(m.id);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
}

/**
 * Sync the inbox into the `emails` table.
 * Returns counts and (intentionally) advances the sync cursor on success.
 */
export async function syncInbox(
  gmail: gmail_v1.Gmail,
  opts: { onTick?: (p: FetchProgress) => void } = {},
): Promise<FetchProgress> {
  const query = buildQuery();
  log.info(`Listing Gmail messages with query: ${query}`);

  const ids: string[] = [];
  await listAllIds(gmail, query, (id) => ids.push(id));
  log.info(`Found ${ids.length} candidate messages.`);

  const bar = new cliProgress.SingleBar(
    {
      format: '  fetch | {bar} | {value}/{total} ({percentage}%) | {speed}/s',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic,
  );
  bar.start(ids.length, 0, { speed: '0' });
  const startTs = Date.now();

  const limiter = pLimit(5);
  const progress: FetchProgress = { fetched: 0, inserted: 0, errors: 0 };
  let maxInternalDate = 0;

  await Promise.all(
    ids.map((id) =>
      limiter(async () => {
        try {
          const res = await withRetry(
            () => gmail.users.messages.get({ userId: 'me', id, format: 'full' }),
            'messages.get',
            4,
          );
          const parsed = parseGmailMessage(res.data);
          if (parsed) {
            const inserted = insertEmail({
              ...parsed,
              fetched_at: Date.now(),
            });
            if (inserted) progress.inserted++;
            if (parsed.internal_date > maxInternalDate) maxInternalDate = parsed.internal_date;
          }
          progress.fetched++;
        } catch (e) {
          progress.errors++;
          log.warn(`Failed to fetch ${id}: ${(e as Error).message}`);
        } finally {
          const elapsedSec = Math.max(1, Math.floor((Date.now() - startTs) / 1000));
          bar.update(progress.fetched, { speed: Math.floor(progress.fetched / elapsedSec) });
          opts.onTick?.(progress);
        }
      }),
    ),
  );

  bar.stop();

  if (maxInternalDate > 0) {
    kvSet(KV_KEYS.syncCursor, String(maxInternalDate));
  }
  kvSet(KV_KEYS.syncLastFinishedAt, String(Date.now()));

  log.info(
    `Fetched ${progress.fetched} (new: ${progress.inserted}, errors: ${progress.errors}).`,
  );
  return progress;
}
