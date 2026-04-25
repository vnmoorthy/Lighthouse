/**
 * `lighthouse setup`
 *
 * What it does, in order:
 *   1. Ensure ~/.lighthouse exists; open the SQLite DB; run migrations.
 *   2. Initialize the vault if not done. Prompt for a passphrase twice.
 *   3. Generate an API bearer token if missing.
 *   4. Run the Gmail OAuth flow if Gmail isn't connected.
 */
import chalk from 'chalk';
import { randomBytes } from 'node:crypto';
import {
  config,
  ensureHome,
  getDb,
  getConnectedEmail,
  initializeVault,
  isVaultInitialized,
  kvGet,
  kvSet,
  KV_KEYS,
  log,
  rekeyVault,
  runOAuthFlow,
  unlockVault,
} from '@lighthouse/core';
import { askLine, askPassphrase, confirm } from '../util/prompt.js';

interface SetupOpts {
  rekey?: boolean;
}

function banner(): void {
  console.log(chalk.cyanBright(`
  ┌──────────────────────────────────────────┐
  │  Lighthouse — local Gmail receipts       │
  │  Privacy-first. AI-powered. MIT.         │
  └──────────────────────────────────────────┘`));
}

async function ensureBearerToken(): Promise<void> {
  if (kvGet(KV_KEYS.apiBearerToken)) return;
  const token = randomBytes(24).toString('hex');
  kvSet(KV_KEYS.apiBearerToken, token);
  log.info('Generated API bearer token.');
}

export async function setupCommand(opts: SetupOpts): Promise<void> {
  banner();
  ensureHome();
  getDb(); // runs migrations

  if (opts.rekey) {
    if (!isVaultInitialized()) {
      throw new Error('Cannot rekey: vault is not initialized yet.');
    }
    const oldPass = await askPassphrase('Current passphrase: ');
    const a = await askPassphrase('New passphrase: ');
    const b = await askPassphrase('Repeat new passphrase: ');
    if (a !== b) throw new Error('Passphrases do not match.');
    if (a.length < 8) throw new Error('New passphrase must be ≥ 8 characters.');
    rekeyVault(oldPass, a, (compat) => {
      const enc = kvGet(KV_KEYS.gmailRefreshTokenEncrypted);
      if (enc) kvSet(KV_KEYS.gmailRefreshTokenEncrypted, compat.encrypt(enc));
    });
    console.log(chalk.green('✓ Rekey complete.'));
    return;
  }

  // 1. Vault.
  if (!isVaultInitialized()) {
    console.log(chalk.gray('\nStep 1/3: choose a passphrase.'));
    console.log(
      chalk.gray('  This passphrase encrypts your Gmail refresh token on disk.'),
    );
    console.log(chalk.gray('  Lighthouse never sees or stores it.'));
    const a = await askPassphrase('  Choose passphrase: ');
    const b = await askPassphrase('  Repeat passphrase: ');
    if (a !== b) throw new Error('Passphrases do not match.');
    initializeVault(a);
    console.log(chalk.green('  ✓ Vault initialized.'));
  } else {
    console.log(chalk.gray('\nStep 1/3: vault already initialized — verifying passphrase.'));
    const p = await askPassphrase('  Enter passphrase: ');
    unlockVault(p); // throws on wrong
    console.log(chalk.green('  ✓ Passphrase verified.'));
  }

  // 2. API token.
  await ensureBearerToken();

  // 3. Gmail.
  const already = getConnectedEmail();
  if (already) {
    console.log(chalk.gray(`\nStep 3/3: Gmail already connected as ${chalk.bold(already)}.`));
    const yes = await confirm('  Reconnect?', false);
    if (!yes) {
      kvSet(KV_KEYS.setupCompletedAt, String(Date.now()));
      console.log(chalk.green('\n✓ Setup complete. Run `npm run sync` next.'));
      return;
    }
  }

  console.log(chalk.gray('\nStep 3/3: connecting Gmail.'));
  if (!config.google.clientId || !config.google.clientSecret) {
    console.log(
      chalk.yellow(
        '  Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env.\n' +
          '  Create OAuth credentials at https://console.cloud.google.com/apis/credentials\n' +
          '  (application type: Desktop app), then re-run `npm run setup`.',
      ),
    );
    return;
  }
  const passForGmail = await askPassphrase('  Enter passphrase to authorize Gmail: ');
  const vault = unlockVault(passForGmail);
  await runOAuthFlow(vault);
  kvSet(KV_KEYS.setupCompletedAt, String(Date.now()));

  console.log(chalk.green('\n✓ Setup complete.'));
  console.log(chalk.gray('  Next: ') + chalk.bold('npm run sync'));
  await askLine(chalk.gray('  Press Enter to exit. '));
}
