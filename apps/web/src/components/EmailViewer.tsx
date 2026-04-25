/**
 * "Show me the proof" view — the original email body that lets a user verify
 * a receipt or subscription extraction.
 *
 * Renders body_text by default; a toggle reveals the original HTML inside an
 * iframe with sandbox="" so links/scripts don't execute. We never call
 * external resources.
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { api, type EmailDetail } from '../lib/api';
import { fmtDate } from '../lib/format';

export default function EmailViewer({ emailId }: { emailId: number | null | undefined }) {
  const [showHtml, setShowHtml] = useState(false);
  const q = useQuery({
    queryKey: ['email', emailId],
    queryFn: () => api<EmailDetail>(`/api/email/${emailId}/raw`),
    enabled: emailId != null,
  });

  if (emailId == null) return null;
  if (q.isLoading) return <div className="text-sm text-lh-mute">Loading email…</div>;
  if (!q.data) return <div className="text-sm text-lh-mute">No email found.</div>;
  const e = q.data;

  return (
    <div className="lh-card overflow-hidden">
      <div className="px-4 py-3 border-b border-lh-line/60 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-xs text-lh-mute">From</div>
          <div className="text-sm font-medium truncate">
            {e.from_name ? `${e.from_name} ` : ''}
            <span className="text-lh-mute">&lt;{e.from_address}&gt;</span>
          </div>
          <div className="text-xs text-lh-mute mt-0.5">
            {e.subject ?? '(no subject)'} · {fmtDate(e.internal_date)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {e.body_html ? (
            <button
              type="button"
              className="lh-btn !py-1 !px-2 text-xs"
              onClick={() => setShowHtml((v) => !v)}
            >
              {showHtml ? 'Show text' : 'Show HTML'}
            </button>
          ) : null}
          <a
            className="lh-btn !py-1 !px-2 text-xs"
            href={e.gmail_url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={12} />
            Open in Gmail
          </a>
        </div>
      </div>
      <div className="max-h-[480px] overflow-auto bg-lh-paper">
        {showHtml && e.body_html ? (
          <iframe
            sandbox=""
            title="email-html"
            className="w-full min-h-[480px] bg-white"
            srcDoc={e.body_html}
          />
        ) : (
          <pre className="text-xs leading-relaxed font-mono whitespace-pre-wrap p-4 text-lh-fore/90">
            {e.body_text ?? '(no plaintext available)'}
          </pre>
        )}
      </div>
    </div>
  );
}
