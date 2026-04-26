/**
 * Gmail OAuth — desktop app flow.
 *
 * Flow:
 *   1. Spin up a localhost HTTP server on a random port.
 *   2. Open the user's browser to the Google consent URL with that port as
 *      the redirect_uri.
 *   3. User clicks Allow → Google redirects back with `?code=...`.
 *   4. We exchange the code for refresh+access tokens, encrypt the refresh
 *      token with the vault, persist it.
 *   5. Subsequent runs: read encrypted refresh token, ask Google for a fresh
 *      access token, use it. The googleapis OAuth2Client handles caching.
 */
import type { OAuth2Client } from 'google-auth-library';
import { google, type gmail_v1 } from 'googleapis';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import open from 'open';
import { config } from '../config.js';
import { kvGet, kvSet, KV_KEYS } from '../db/kv.js';
import type { UnlockedVault } from '../crypto/vault.js';
import { log } from '../logger.js';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export class GmailAuthError extends Error {}

function buildClient(redirectUri?: string): OAuth2Client {
  if (!config.google.clientId || !config.google.clientSecret) {
    throw new GmailAuthError(
      'Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env. ' +
        'Create OAuth credentials at https://console.cloud.google.com/apis/credentials ' +
        '(application type: Desktop app).',
    );
  }
  return new google.auth.OAuth2(config.google.clientId, config.google.clientSecret, redirectUri);
}

/** Run the interactive consent flow. Returns once the refresh token is stored. */
export async function runOAuthFlow(vault: UnlockedVault): Promise<{ email: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
      const code = url.searchParams.get('code');
      const errParam = url.searchParams.get('error');
      if (errParam) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h1>Auth failed</h1><p>${errParam}</p>`);
        server.close();
        reject(new GmailAuthError(`OAuth error: ${errParam}`));
        return;
      }
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('Missing code.');
        return;
      }
      try {
        const port = (server.address() as AddressInfo).port;
        const client = buildClient(`http://127.0.0.1:${port}`);
        const { tokens } = await client.getToken(code);
        if (!tokens.refresh_token) {
          throw new GmailAuthError(
            "No refresh token returned. Revoke previous access at https://myaccount.google.com/permissions and try again.",
          );
        }
        client.setCredentials(tokens);
        // Capture the email address to display in the UI.
        const userInfo = google.oauth2('v2').userinfo.get({ auth: client });
        const info = await userInfo;
        const email = info.data.email ?? '(unknown)';

        kvSet(KV_KEYS.gmailRefreshTokenEncrypted, vault.encrypt(tokens.refresh_token));
        kvSet(KV_KEYS.gmailUserEmail, email);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html><head><title>Lighthouse</title>
          <style>body{font-family:system-ui,sans-serif;background:#0b0f17;color:#e7eef8;
            display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
            .card{background:#131a26;padding:48px;border-radius:16px;text-align:center;
            box-shadow:0 8px 40px rgba(0,0,0,.5)}
            h1{margin:0 0 12px;font-size:28px}
            p{margin:0;color:#94a3b8}
          </style></head><body>
          <div class="card">
            <h1>Lighthouse is connected</h1>
            <p>You can close this tab and return to your terminal.</p>
            <p style="margin-top:16px;font-size:14px">Signed in as <code>${email}</code></p>
          </div></body></html>`);
        server.close();
        resolve({ email });
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(String(e));
        server.close();
        reject(e);
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      const redirect = `http://127.0.0.1:${port}`;
      const client = buildClient(redirect);
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent', // force refresh-token issuance even on re-auth
        scope: SCOPES,
      });
      log.info(`Opening browser to authorize Gmail access...`);
      log.info(`If it doesn't open, visit: ${authUrl}`);
      void open(authUrl).catch(() => {
        // open() can fail in headless environments; the link is logged above.
      });
    });
    server.on('error', reject);
  });
}

/** Build an authenticated Gmail client using the stored refresh token. */
export function getGmailClient(vault: UnlockedVault): gmail_v1.Gmail {
  const enc = kvGet(KV_KEYS.gmailRefreshTokenEncrypted);
  if (!enc) {
    throw new GmailAuthError(
      'Gmail is not connected. Run `npm run setup` to connect your account.',
    );
  }
  const refreshToken = vault.decrypt(enc);
  const client = buildClient();
  client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth: client });
}

export function getConnectedEmail(): string | null {
  return kvGet(KV_KEYS.gmailUserEmail);
}
