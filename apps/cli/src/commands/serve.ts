/**
 * `lighthouse serve`
 *
 * Boots the API + serves the SPA (if built). The dashboard polls a
 * `__token__` endpoint to grab the bearer.
 */
import chalk from 'chalk';
import {
  bootstrapOrchestrator,
  config,
  getDb,
  isVaultInitialized,
  kvGet,
  KV_KEYS,
  startServer,
} from '@lighthouse/core';
import { askPassphrase } from '../util/prompt.js';

export async function serveCommand(): Promise<void> {
  getDb();
  if (!isVaultInitialized()) throw new Error('Run `npm run setup` first.');
  if (!kvGet(KV_KEYS.apiBearerToken)) {
    throw new Error('API token missing — run `npm run setup`.');
  }

  const passphrase = process.env.LIGHTHOUSE_PASSPHRASE
    ?? (await askPassphrase('Vault passphrase: '));

  await bootstrapOrchestrator(passphrase);
  const server = await startServer();
  console.log();
  console.log(chalk.cyanBright('  Lighthouse is running.'));
  console.log(chalk.gray('  API:        ') + chalk.white(server.url));
  console.log(chalk.gray('  Dashboard:  ') + chalk.white(`http://127.0.0.1:${config.webPort}`));
  console.log(chalk.gray('  (in dev, run `npm run dev:web` separately)'));
  console.log();
  console.log(chalk.gray('  Ctrl-C to stop.'));

  process.on('SIGINT', () => {
    console.log(chalk.gray('\nShutting down...'));
    void server.stop().then(() => process.exit(0));
  });
  // Keep the event loop alive.
  await new Promise(() => {});
}
