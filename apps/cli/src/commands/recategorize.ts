/**
 * `lighthouse recategorize` — re-run the LLM categorizer on merchants
 * that landed on 'other' and report the result.
 *
 * Useful after a long sync when the merchant_alias_cache filled up with
 * generic categories. Cheap to run.
 */
import chalk from 'chalk';
import { getDb, recategorizeMerchants } from '@lighthouse/core';

export async function recategorizeCommand(): Promise<void> {
  getDb();
  const stats = await recategorizeMerchants();
  if (stats.merchants_examined === 0) {
    console.log(chalk.green('✓ No merchants need recategorizing.'));
    return;
  }
  console.log(
    chalk.green(
      `✓ Recategorize complete: ${stats.merchants_updated} updated, ${stats.errors} errors, of ${stats.merchants_examined} examined.`,
    ),
  );
}
