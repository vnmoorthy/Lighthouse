/**
 * `lighthouse import-takeout`
 *
 * Parses a Google Takeout mbox file ("All mail Including Spam and Trash.mbox")
 * and inserts each message into the `emails` table — the same shape as the
 * Gmail OAuth path, so the rest of the pipeline runs unchanged.
 *
 * mbox format reminder: messages are separated by `From ` lines at the
 * beginning of a line. Body is RFC822. We use a tiny streaming parser
 * because real Takeouts are gigabytes.
 */
import chalk from 'chalk';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import {
  getDb,
  insertEmail,
  log,
} from '@lighthouse/core';

interface ImportOpts {
  file: string;
}

interface RawMessage {
  raw: string;
}

/** Stream-iterate mbox messages. */
async function* mboxIterate(filePath: string): AsyncGenerator<RawMessage> {
  const stream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let buf: string[] = [];
  for await (const line of rl) {
    if (line.startsWith('From ') && buf.length > 0) {
      yield { raw: buf.join('\n') };
      buf = [];
      continue;
    }
    buf.push(line);
  }
  if (buf.length > 0) yield { raw: buf.join('\n') };
}

interface ParsedRfc822 {
  from: string;
  fromName: string | null;
  subject: string | null;
  date: number;
  text: string;
  messageId: string;
  threadId: string;
}

function decodeBody(body: string, encoding: string | null): string {
  if (!encoding) return body;
  if (/quoted-printable/i.test(encoding)) {
    return body
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hx) => String.fromCharCode(Number.parseInt(hx, 16)));
  }
  if (/base64/i.test(encoding)) {
    try { return Buffer.from(body, 'base64').toString('utf-8'); } catch { return body; }
  }
  return body;
}

function parseRfc822(raw: string): ParsedRfc822 | null {
  const headerEnd = raw.indexOf('\n\n');
  if (headerEnd < 0) return null;
  const headers = raw.slice(0, headerEnd);
  const body = raw.slice(headerEnd + 2);

  const get = (name: string): string | null => {
    const re = new RegExp(`^${name}:\\s*(.+(?:\\r?\\n[\\t ].+)*)`, 'mi');
    const m = re.exec(headers);
    return m ? m[1]!.replace(/\r?\n[\t ]/g, ' ').trim() : null;
  };

  const fromHeader = get('From') ?? '';
  const fmtMatch = /^\s*"?([^"<]*?)"?\s*<([^>]+)>/.exec(fromHeader);
  const from = fmtMatch ? fmtMatch[2]!.toLowerCase() : fromHeader.toLowerCase().trim();
  const fromName = fmtMatch ? (fmtMatch[1] ?? '').trim() || null : null;

  const subject = get('Subject');
  const dateRaw = get('Date');
  const date = dateRaw ? Date.parse(dateRaw) : Date.now();
  const messageIdRaw = get('Message-ID') ?? createHash('md5').update(raw).digest('hex');
  const messageId = messageIdRaw.replace(/[<>]/g, '');

  const xthread = get('X-GM-THRID');
  const threadId = xthread ?? createHash('md5').update(messageId).digest('hex').slice(0, 16);

  // Try to find a text/plain part. If not, decode the whole body.
  const ctype = get('Content-Type') ?? '';
  const cte = get('Content-Transfer-Encoding');
  let text = '';
  if (/multipart/i.test(ctype)) {
    const m = /boundary="?([^";]+)"?/i.exec(ctype);
    const boundary = m ? m[1] : null;
    if (boundary) {
      const parts = body.split('--' + boundary);
      for (const p of parts) {
        if (/Content-Type:\s*text\/plain/i.test(p)) {
          const partHeaderEnd = p.indexOf('\n\n');
          if (partHeaderEnd > 0) {
            const partCte = /Content-Transfer-Encoding:\s*([^\r\n]+)/i.exec(p.slice(0, partHeaderEnd));
            text = decodeBody(p.slice(partHeaderEnd + 2), partCte ? partCte[1] : null);
            break;
          }
        }
      }
    }
  }
  if (!text) text = decodeBody(body, cte);
  text = text.slice(0, 64 * 1024);

  return {
    from: from || 'unknown@unknown',
    fromName,
    subject,
    date: Number.isFinite(date) ? date : Date.now(),
    text,
    messageId,
    threadId,
  };
}

export async function importTakeoutCommand(opts: ImportOpts): Promise<void> {
  getDb();
  console.log(chalk.gray(`Importing mbox: ${opts.file}`));
  let n = 0;
  let inserted = 0;
  for await (const msg of mboxIterate(opts.file)) {
    const p = parseRfc822(msg.raw);
    n++;
    if (!p) continue;
    const id = insertEmail({
      gmail_message_id: p.messageId,
      gmail_thread_id: p.threadId,
      internal_date: p.date,
      from_address: p.from,
      from_name: p.fromName,
      subject: p.subject,
      snippet: p.text.slice(0, 200),
      body_text: p.text,
      body_html: null,
      raw_headers_json: null,
      fetched_at: Date.now(),
    });
    if (id) inserted++;
    if (n % 500 === 0) log.info(`Imported ${n} (new: ${inserted})...`);
  }
  console.log(chalk.green(`✓ Imported ${n} messages (${inserted} new).`));
  console.log(chalk.gray('  Next: ') + chalk.bold('npm run sync -- --no-fetch'));
}
