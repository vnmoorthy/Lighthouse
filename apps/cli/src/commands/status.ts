/**
 * `lighthouse status` — quick summary of pipeline state.
 */
import chalk from 'chalk';
import {
  config,
  countEmailsByStatus,
  getConnectedEmail,
  getDb,
  getLatestSyncRun,
  kvGet,
  KV_KEYS,
  listOpenAlerts,
  listSubscriptions,
} from '@lighthouse/core';

function fmtTs(ms: number | null): string {
  if (!ms) return chalk.gray('never');
  return new Date(ms).toLocaleString();
}

export async function statusCommand(): Promise<void> {
  getDb();
  const counts = countEmailsByStatus();
  const subs = listSubscriptions();
  const active = subs.filter((s) => s.status === 'active');
  const trial = subs.filter((s) => s.status === 'trial');
  const cancelled = subs.filter((s) => s.status === 'cancelled');
  const last = getLatestSyncRun();
  const alerts = listOpenAlerts();

  const total = subs.reduce((acc, s) => acc + s.amount_cents, 0);

  console.log(chalk.bold('\n  Lighthouse status'));
  console.log(chalk.gray('  ────────────────'));
  console.log(`  Account:         ${chalk.cyan(getConnectedEmail() ?? '(not connected)')}`);
  console.log(`  Database:        ${config.dbPath}`);
  console.log(`  LLM provider:    ${config.llm.provider} (${
    config.llm.provider === 'anthropic' ? config.llm.anthropic.model : config.llm.ollama.model
  })`);
  console.log();
  console.log(chalk.bold('  Email pipeline'));
  console.log(`    pending:   ${counts.pending}`);
  console.log(`    classified:${counts.classified}`);
  console.log(`    done:      ${counts.done}`);
  console.log(`    skipped:   ${counts.skipped}`);
  console.log(`    error:     ${counts.error}`);
  console.log();
  console.log(chalk.bold('  Subscriptions'));
  console.log(`    active:    ${chalk.greenBright(active.length)}`);
  console.log(`    trial:     ${trial.length}`);
  console.log(`    cancelled: ${cancelled.length}`);
  console.log(
    `    rough total (sum of amounts): ${chalk.yellow(`$${(total / 100).toFixed(2)}`)}`,
  );
  console.log();
  console.log(chalk.bold('  Alerts'));
  console.log(`    open:      ${alerts.length > 0 ? chalk.red(alerts.length) : 0}`);
  console.log();
  console.log(chalk.bold('  Last sync'));
  console.log(`    started:   ${fmtTs(last?.started_at ?? null)}`);
  console.log(`    finished:  ${fmtTs(last?.finished_at ?? null)}`);
  console.log(`    fetched:   ${last?.emails_fetched ?? 0}`);
  console.log(`    processed: ${last?.emails_processed ?? 0}`);
  console.log(`    cursor:    ${kvGet(KV_KEYS.syncCursor) ?? '(none)'}`);
  console.log();
}
