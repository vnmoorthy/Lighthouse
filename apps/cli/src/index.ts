#!/usr/bin/env node
/**
 * Lighthouse CLI entry point.
 *
 * Usage: `lighthouse <command>`. Commands live in ./commands/*.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { setupCommand } from './commands/setup.js';
import { syncCommand } from './commands/sync.js';
import { serveCommand } from './commands/serve.js';
import { statusCommand } from './commands/status.js';
import { alertsCommand } from './commands/alerts.js';
import { exportCommand } from './commands/export.js';
import { importTakeoutCommand } from './commands/import_takeout.js';
import { digestCommand } from './commands/digest.js';

const program = new Command();
program
  .name('lighthouse')
  .description('Self-hosted Gmail receipt and subscription tracker.')
  .version('0.1.0');

program
  .command('setup')
  .description('Configure passphrase + Gmail OAuth.')
  .option('--rekey', 'Change the vault passphrase.')
  .action(async (opts) => {
    try {
      await setupCommand(opts);
    } catch (e) {
      console.error(chalk.red(`✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('sync')
  .description('Fetch Gmail messages and run the extraction pipeline.')
  .option('--no-fetch', 'Skip Gmail fetch; only run the pipeline on already-stored emails.')
  .action(async (opts) => {
    try {
      await syncCommand(opts);
    } catch (e) {
      console.error(chalk.red(`✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Start the local API + dashboard.')
  .action(async () => {
    try {
      await serveCommand();
    } catch (e) {
      console.error(chalk.red(`✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Print pipeline and database stats.')
  .action(async () => {
    try {
      await statusCommand();
    } catch (e) {
      console.error(chalk.red(`✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('alerts')
  .description('List currently-open alerts.')
  .action(async () => {
    try {
      await alertsCommand();
    } catch (e) {
      console.error(chalk.red(`✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('export')
  .description('Export receipts (CSV) and subscriptions (JSON) to disk.')
  .option('-o, --out <dir>', 'Output directory.', './lighthouse-export')
  .option(
    '--tax-only',
    'Restrict CSV to merchants in business-deductible categories.',
    false,
  )
  .option(
    '--format <fmt>',
    'Output format: lighthouse | ynab | lunchmoney | beancount.',
    'lighthouse',
  )
  .action(async (opts) => {
    try {
      await exportCommand(opts);
    } catch (e) {
      console.error(chalk.red(`✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('digest')
  .description('Print a markdown summary of the last N days (default 7).')
  .option('--days <n>', 'Number of trailing days to summarize.', '7')
  .option('--json', 'Emit JSON instead of Markdown.', false)
  .action(async (opts) => {
    try {
      await digestCommand(opts);
    } catch (e) {
      console.error(chalk.red(`✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('import-takeout')
  .description('Import a Google Takeout mbox instead of using OAuth.')
  .requiredOption('-f, --file <path>', 'Path to All mail Including Spam and Trash.mbox')
  .action(async (opts) => {
    try {
      await importTakeoutCommand(opts);
    } catch (e) {
      console.error(chalk.red(`✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((e: unknown) => {
  console.error(chalk.red(String(e)));
  process.exit(1);
});
