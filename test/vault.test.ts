/**
 * Vault round-trip tests.
 *
 * These run against an in-memory better-sqlite3 — but our vault module
 * persists salt/verifier through the kv table, which lives in the real DB.
 * To keep things isolated we point LIGHTHOUSE_HOME at a tmp dir before
 * importing the module.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'lighthouse-test-'));
process.env.LIGHTHOUSE_HOME = tmp;

const { getDb, closeDb } = await import('../packages/core/src/db/index.js');
const { initializeVault, unlockVault, isVaultInitialized, WrongPassphraseError } =
  await import('../packages/core/src/crypto/vault.js');

describe('vault', () => {
  beforeAll(() => {
    getDb(); // run migrations
  });
  afterAll(() => {
    closeDb();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('initializes only once', () => {
    expect(isVaultInitialized()).toBe(false);
    const v = initializeVault('hunter2-yes-please');
    expect(isVaultInitialized()).toBe(true);
    const cipher = v.encrypt('howdy');
    expect(cipher).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
    expect(v.decrypt(cipher)).toBe('howdy');
  });

  it('unlocks with the right passphrase', () => {
    const v = unlockVault('hunter2-yes-please');
    const ct = v.encrypt('the answer is 42');
    expect(v.decrypt(ct)).toBe('the answer is 42');
  });

  it('rejects the wrong passphrase', () => {
    expect(() => unlockVault('totally-wrong')).toThrow(WrongPassphraseError);
  });

  it('rejects too-short passphrases on init', () => {
    // The vault is already initialized in this test suite; test the validation
    // by reaching into a fresh process state. Easiest path: assert the error
    // message of `initializeVault` is well-formed without actually re-initing.
    expect(() => initializeVault('short')).toThrow(/at least 8 characters/);
  });
});
