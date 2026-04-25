/**
 * "Show me the proof" view — the original email body that lets a user
 * verify a receipt or subscription extraction.
 *
 * Plaintext by default. The "Show HTML" toggle reveals the original HTML
 * inside an iframe with sandbox="" so scripts/forms/navigation are all
 * blocked.
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ExternalLink, FileText, Eye } from 'lucide-react';
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
  if (q.isLoading) {
    return (
      <div className="lh-card p-4 space-y-2">
        <div className="lh-skeleton h-3 w-20" />
        <div className="lh-skeleton h-4 w-2/3" />
        <div className="lh-skeleton h-3 w-1/2" />
        <div className="lh-skeleton h-32 w-full mt-3" />
      </div>
    );
  }
  if (!q.data) return <div className="text-sm text-lh-mute">No email found.</div>;
  const e = q.data;

  return (
    <div className="lh-card overflow-hidden">
      <div className="px-4 py-3 border-b border-lh-line/60 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="lh-eyebrow mb-1">From</div>
          <div className="text-sm font-medium truncate text-lh-fore">
            {e.from_name ? `${e.from_name} ` : ''}
            <span className="text-lh-mute font-normal">&lt;{e.from_address}&gt;</span>
          </div>
          <div className="text-xs text-lh-mute mt-1.5 line-clamp-1">
            <span className="font-medium text-lh-fore/80">{e.subject ?? '(no subject)'}</span>
            <span className="mx-2">·</span>
            {fmtDate(e.internal_date)}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {e.body_html ? (
            <button
              type="button"
              className="lh-btn-ghost text-2xs"
              onClick={() => setShowHtml((v) => !v)}
              title={showHtml ? 'Show plaintext' : 'Show original HTML'}
            >
              {showHtml ? <FileText size={12} /> : <Eye size={12} />}
              {showHtml ? 'Plaintext' : 'HTML'}
            </button>
          ) : null}
          <a
            className="lh-btn-ghost text-2xs"
            href={e.gmail_url}
            target="_blank"
            rel="noreferrer"
            title="Open in Gmail"
          >
            <ExternalLink size={12} />
            Open
          </a>
        </div>
      </div>
      <div className="max-h-[420px] overflow-auto bg-lh-paper">
        {showHtml && e.body_html ? (
          <iframe
            sandbox=""
            title="email-html"
            className="w-full min-h-[420px] bg-white"
            srcDoc={e.body_html}
          />
        ) : (
          <pre className="text-xs leading-relaxed font-mono whitespace-pre-wrap p-4 text-lh-fore/80">
            {e.body_text ?? '(no plaintext available)'}
          </pre>
        )}
      </div>
    </div>
  );
}
