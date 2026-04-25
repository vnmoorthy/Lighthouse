/**
 * `lighthouse sync`
 *
 *   1. Unlock vault with passphrase.
 *   2. Fetch new Gmail messages (unless --no-fetch).
 *   3. Run the LLM extraction pipeline on pending emails.
 *   4. Run dedupe + alerts.
 */
import chalk from 'chalk';
import {
  finishSyncRun,
  getDb,
  getGmailClient,
  isVaultInitialized,
  kvGet,
  KV_KEYS,
  runPipeline,
  runPostProcessing,
  startSyncRun,
  syncInbox,
  unlockVault,
  updateSyncRun,
} from '@lighthouse/core';
import { askPassphrase } from '../util/prompt.js';

interface SyncOpts {
  fetch?: boolean;
}

export async function syncCommand(opts: SyncOpts): Promise<void> {
  getDb();
  if (!isVaultInitialized()) throw new Error('Run `npm run setup` first.');
  if (!kvGet(KV_KEYS.gmailRefreshTokenEncrypted) && opts.fetch !== false) {
    throw new Error('Gmail is not connected. Run `npm run setup` first.');
  }

  const passphrase = process.env.LIGHTHOUSE_PASSPHRASE
    ?? (await askPassphrase('Vault passphrase: '));
  const vault = unlockVault(passphrase);

  const runId = startSyncRun();
  console.log(chalk.gray(`Sync run #${runId} started.`));

  try {
    if (opts.fetch !== false) {
      const gmail = getGmailClient(vault);
      const result = await syncInbox(gmail);
      updateSyncRun(runId, { emails_fetched: result.fetched });
    } else {
      console.log(chalk.gray('Skipping Gmail fetch (--no-fetch).'));
    }

    const stats = await runPipeline();
    updateSyncRun(runId, { emails_processed: stats.classified });
    runPostProcessing();
    finishSyncRun(runId, 'finished');

    console.log(
      chalk.green(`✓ Sync complete: ${stats.receipts} receipts, ${stats.subscriptions} sub events, ${stats.errors} errors.`),
    );
    console.log(chalk.gray('  Next: ') + chalk.bold('npm run serve'));
  } catch (e) {
    finishSyncRun(runId, 'failed');
    throw e;
  }
}
