/**
 * Background sync orchestrator.
 *
 * Bound to the API server's lifetime. Lets the dashboard kick off a sync
 * with one POST and then poll progress. Only one sync runs at a time —
 * concurrent kicks return the existing run id.
 */
import {
  finishSyncRun,
  startSyncRun,
  updateSyncRun,
} from '../db/queries.js';
import { getGmailClient } from '../gmail/auth.js';
import { syncInbox } from '../gmail/fetch.js';
import { runPipeline, runPostProcessing } from '../pipeline/index.js';
import { unlockVault } from '../crypto/vault.js';
import { kvGet, KV_KEYS } from '../db/kv.js';
import { log } from '../logger.js';
import type { UnlockedVault } from '../crypto/vault.js';

class SyncOrchestrator {
  private active: Promise<number> | null = null;
  private vault: UnlockedVault | null = null;
  private currentRunId: number | null = null;

  /** Provide an unlocked vault, captured by the API process at startup. */
  setVault(v: UnlockedVault): void {
    this.vault = v;
  }

  async kick(): Promise<number> {
    if (this.active && this.currentRunId != null) return this.currentRunId;
    if (!this.vault) throw new Error('Vault not unlocked. Restart the server.');
    if (kvGet(KV_KEYS.gmailRefreshTokenEncrypted) == null) {
      throw new Error('Gmail not connected. Run `npm run setup` first.');
    }

    const runId = startSyncRun();
    this.currentRunId = runId;
    this.active = (async () => {
      try {
        const gmail = getGmailClient(this.vault!);
        const fetched = await syncInbox(gmail);
        updateSyncRun(runId, {
          emails_fetched: fetched.fetched,
        });
        const stats = await runPipeline();
        updateSyncRun(runId, {
          emails_processed: stats.classified,
          errors_json: stats.errors > 0 ? JSON.stringify({ errors: stats.errors }) : null,
        });
        runPostProcessing();
        finishSyncRun(runId, 'finished');
        log.info(`Sync run ${runId} finished.`);
      } catch (e) {
        finishSyncRun(runId, 'failed');
        updateSyncRun(runId, { errors_json: JSON.stringify({ message: (e as Error).message }) });
        log.error(`Sync run ${runId} failed: ${(e as Error).message}`);
      } finally {
        this.active = null;
        this.currentRunId = null;
      }
      return runId;
    })();
    return runId;
  }
}

export const syncOrchestrator = new SyncOrchestrator();

export async function bootstrapOrchestrator(passphrase: string): Promise<void> {
  // Used by `serve` to hand the orchestrator a vault before opening the port.
  syncOrchestrator.setVault(unlockVault(passphrase));
}
