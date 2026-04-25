/**
 * Decode a Gmail message payload into a clean shape.
 *
 * Gmail returns MIME trees as nested `parts`. We walk it, decode base64url
 * bodies, prefer text/plain, fall back to text/html (stripped). We also
 * pull the From header into name + address pieces, and produce a stable
 * `internal_date` (ms since epoch).
 */
import type { gmail_v1 } from 'googleapis';

export interface ParsedEmail {
  gmail_message_id: string;
  gmail_thread_id: string;
  internal_date: number;
  from_address: string;
  from_name: string | null;
  subject: string | null;
  snippet: string | null;
  body_text: string | null;
  body_html: string | null;
  raw_headers_json: string;
}

const MAX_HTML_BYTES = 100 * 1024;

function decodeBase64Url(b64: string): Buffer {
  return Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string | null {
  if (!headers) return null;
  const target = name.toLowerCase();
  for (const h of headers) {
    if ((h.name ?? '').toLowerCase() === target) return h.value ?? null;
  }
  return null;
}

/** "Jane <jane@example.com>" → { name: "Jane", address: "jane@example.com" } */
export function parseFrom(value: string | null): { name: string | null; address: string } {
  if (!value) return { name: null, address: '' };
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value);
  if (m) {
    return { name: (m[1] ?? '').trim() || null, address: (m[2] ?? '').toLowerCase() };
  }
  return { name: null, address: value.trim().toLowerCase() };
}

/** Recursively walk parts collecting text/plain and text/html. */
function collectBodies(part: gmail_v1.Schema$MessagePart, acc: { text: string[]; html: string[] }): void {
  const mt = (part.mimeType ?? '').toLowerCase();
  if (mt === 'text/plain' && part.body?.data) {
    acc.text.push(decodeBase64Url(part.body.data).toString('utf-8'));
  } else if (mt === 'text/html' && part.body?.data) {
    acc.html.push(decodeBase64Url(part.body.data).toString('utf-8'));
  }
  if (part.parts) for (const p of part.parts) collectBodies(p, acc);
}

/** Quick-and-dirty HTML → text. Good enough for receipt content; we don't try to be a browser. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number.parseInt(n, 10)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseGmailMessage(msg: gmail_v1.Schema$Message): ParsedEmail | null {
  if (!msg.id || !msg.threadId) return null;
  const headers = msg.payload?.headers ?? [];
  const fromRaw = getHeader(headers, 'From');
  const { name, address } = parseFrom(fromRaw);
  const subject = getHeader(headers, 'Subject');
  const internalDate = msg.internalDate ? Number.parseInt(msg.internalDate, 10) : Date.now();

  const acc = { text: [] as string[], html: [] as string[] };
  if (msg.payload) collectBodies(msg.payload, acc);

  let bodyText = acc.text.join('\n').trim();
  let bodyHtml = acc.html.join('\n').trim();
  // If we have HTML but no plaintext, derive plaintext.
  if (!bodyText && bodyHtml) bodyText = htmlToText(bodyHtml);
  // Truncate huge HTML — we keep the plaintext for extraction either way.
  let truncated = false;
  if (Buffer.byteLength(bodyHtml, 'utf-8') > MAX_HTML_BYTES) {
    bodyHtml = bodyHtml.slice(0, MAX_HTML_BYTES);
    truncated = true;
  }

  // Compact header subset for the DB. Full headers are useless and big.
  const wanted = ['Date', 'List-Unsubscribe', 'Return-Path', 'Reply-To', 'Message-ID'];
  const subset: Record<string, string> = {};
  for (const k of wanted) {
    const v = getHeader(headers, k);
    if (v != null) subset[k] = v;
  }
  if (truncated) subset['X-Lighthouse-Truncated'] = '1';

  return {
    gmail_message_id: msg.id,
    gmail_thread_id: msg.threadId,
    internal_date: internalDate,
    from_address: address,
    from_name: name,
    subject,
    snippet: msg.snippet ?? null,
    body_text: bodyText || null,
    body_html: bodyHtml || null,
    raw_headers_json: JSON.stringify(subset),
  };
}
