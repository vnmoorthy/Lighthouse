/**
 * Local secret vault.
 *
 * - Key derivation: argon2id from `@noble/hashes` (memory-hard, recommended).
 * - Encryption: AES-256-GCM via Node's built-in `crypto`.
 * - Storage: salt + verifier go in the `kv` table; encrypted blobs are stored
 *   wherever the caller wants (we expose encrypt/decrypt primitives).
 *
 * Security model: this is a defense-in-depth layer for someone who finds the
 * SQLite file on a stolen laptop. It is not a substitute for full-disk
 * encryption. The passphrase is never written to disk; we keep the derived
 * key in memory for the duration of a CLI command.
 */
import { argon2id } from '@noble/hashes/argon2';
import { randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import { kvGet, kvSet, KV_KEYS } from '../db/kv.js';

const KEY_LEN = 32;
const SALT_LEN = 16;
const IV_LEN = 12; // GCM standard
const TAG_LEN = 16;
// Argon2id parameters tuned for ~250 ms on a modern laptop. Cheap enough that
// the user doesn't notice setup, expensive enough that bruteforce is painful.
const ARGON = { t: 3, m: 64 * 1024, p: 1 } as const;
// A constant string that we encrypt with the derived key on first setup. On
// subsequent unlocks we decrypt and compare — if the passphrase is wrong the
// AES-GCM auth tag check fails, which we report as a clean error.
const VERIFIER_PLAINTEXT = 'lighthouse-vault-v1';

export class VaultError extends Error {}
export class WrongPassphraseError extends VaultError {
  constructor() {
    super('Incorrect passphrase.');
  }
}

export interface UnlockedVault {
  key: Buffer;
  encrypt(plaintext: string): string;
  decrypt(payload: string): string;
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  const out = argon2id(passphrase, salt, { ...ARGON, dkLen: KEY_LEN });
  return Buffer.from(out);
}

/** payload format: base64(iv) . base64(tag) . base64(ciphertext) */
function encryptWithKey(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.');
}

function decryptWithKey(key: Buffer, payload: string): string {
  const [ivB64, tagB64, ctB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !ctB64) throw new VaultError('Malformed ciphertext.');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new VaultError('Malformed ciphertext.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf-8');
  } catch {
    throw new WrongPassphraseError();
  }
}

function makeUnlocked(key: Buffer): UnlockedVault {
  return {
    key,
    encrypt: (s) => encryptWithKey(key, s),
    decrypt: (s) => decryptWithKey(key, s),
  };
}

export function isVaultInitialized(): boolean {
  return kvGet(KV_KEYS.vaultSalt) != null && kvGet(KV_KEYS.vaultVerifier) != null;
}

/**
 * First-run: create salt, derive key, store an encrypted verifier so we can
 * detect wrong passphrases on subsequent unlocks.
 */
export function initializeVault(passphrase: string): UnlockedVault {
  if (passphrase.length < 8) throw new VaultError('Passphrase must be at least 8 characters.');
  const salt = randomBytes(SALT_LEN);
  const key = deriveKey(passphrase, salt);
  const verifier = encryptWithKey(key, VERIFIER_PLAINTEXT);
  kvSet(KV_KEYS.vaultSalt, salt.toString('base64'));
  kvSet(KV_KEYS.vaultVerifier, verifier);
  return makeUnlocked(key);
}

export function unlockVault(passphrase: string): UnlockedVault {
  const saltB64 = kvGet(KV_KEYS.vaultSalt);
  const verifier = kvGet(KV_KEYS.vaultVerifier);
  if (!saltB64 || !verifier) throw new VaultError('Vault is not initialized. Run `npm run setup`.');
  const key = deriveKey(passphrase, Buffer.from(saltB64, 'base64'));
  const got = decryptWithKey(key, verifier);
  // Use timingSafeEqual just for symmetry — GCM auth-tag check is itself
  // constant-time, but defence in depth doesn't cost anything here.
  const a = Buffer.from(got);
  const b = Buffer.from(VERIFIER_PLAINTEXT);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new WrongPassphraseError();
  return makeUnlocked(key);
}

/** Re-key: change passphrase but keep all currently-stored encrypted blobs. */
export function rekeyVault(
  oldPassphrase: string,
  newPassphrase: string,
  reencrypt: (vault: UnlockedVault) => void,
): UnlockedVault {
  const old = unlockVault(oldPassphrase);
  // First, decrypt-then-reencrypt all callers' secrets via the callback before
  // we swap the verifier.
  const fresh = initializeVault(newPassphrase);
  reencrypt(
    Object.freeze({
      key: fresh.key,
      encrypt: (s: string) => fresh.encrypt(old.decrypt(s)),
      decrypt: (s: string) => old.decrypt(s),
    }),
  );
  return fresh;
}
