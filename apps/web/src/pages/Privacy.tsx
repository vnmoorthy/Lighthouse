/**
 * "What does Lighthouse know about you?" page.
 *
 * Reads from the existing summary endpoint and presents the data in a
 * deliberately blunt format — counts, sizes, what's encrypted, what
 * isn't — so the user can see exactly what's stored. The framing is
 * the opposite of a dark pattern: maximize transparency.
 */
import { useQuery } from '@tanstack/react-query';
import { api, type SettingsResponse, type SummaryResponse } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { ShieldCheck, ShieldAlert, Lock, Eye, Globe, Database } from 'lucide-react';

export default function PrivacyPage() {
  const summary = useQuery({
    queryKey: ['privacy-summary'],
    queryFn: () => api<SummaryResponse>('/api/summary'),
  });
  const settings = useQuery({
    queryKey: ['privacy-settings'],
    queryFn: () => api<SettingsResponse>('/api/settings'),
  });
  const counts = summary.data?.email_processing ?? null;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Transparency"
        title="What Lighthouse knows"
        description="Everything stored, every external call, every place a secret lives. By design, the answer is short."
      />
      <div className="p-8 max-w-3xl space-y-5">
        <Section
          title="On disk, on your machine"
          icon={<Database size={14} className="text-lh-mint" />}
        >
          <Row label="Database file" value={settings.data?.db_path ?? '~/.lighthouse/lighthouse.db'} mono />
          <Row label="Receipts indexed" value={total > 0 ? `${total.toLocaleString()} emails` : 'none yet'} />
          <Row
            label="What's encrypted"
            value={
              <>
                Your Gmail refresh token (argon2id-derived AES-256-GCM key).
                Everything else (receipts, line items, merchant rules) is in
                plaintext SQLite — the threat model is "lost laptop with FDE",
                not "rogue process on the box".
              </>
            }
          />
        </Section>

        <Section
          title="What leaves this machine"
          icon={<Globe size={14} className="text-lh-azure" />}
        >
          <Row
            label="Gmail API"
            value={
              <>
                Read-only. Lighthouse uses{' '}
                <code className="text-lh-fore px-1 py-0.5 bg-lh-line rounded font-mono text-2xs">
                  gmail.readonly
                </code>{' '}
                — it can't send, modify, or delete mail.
              </>
            }
          />
          <Row
            label="LLM provider"
            value={
              <>
                {settings.data?.llm_provider === 'ollama'
                  ? 'Ollama, on this machine — zero outbound traffic.'
                  : 'Cloud (configurable). Email bodies are sent to the configured provider for structured extraction. Switch to LLM_PROVIDER=ollama if you want zero outbound traffic.'}
              </>
            }
          />
          <Row label="Telemetry" value="None. We don't ping a server, ever." />
          <Row label="Webhooks" value="If you configure one in Settings, alerts are POSTed there as JSON. You opt in." />
        </Section>

        <Section
          title="What stays here"
          icon={<Lock size={14} className="text-lh-violet" />}
        >
          <Row label="Email content" value="Stored in SQLite as plaintext. Never sent to anyone except the LLM provider for extraction." />
          <Row label="Order numbers, payment hints" value="Stored. Visible in the dashboard. You can wipe at any time." />
          <Row label="Tags, categories, budgets" value="All local. Custom-alert rules and webhook URLs too." />
        </Section>

        <Section
          title="What we don't have"
          icon={<ShieldCheck size={14} className="text-lh-mint" />}
        >
          <Row label="Bank credentials" value="Never asked, never stored. Lighthouse derives merchants from emails." />
          <Row label="Card numbers" value="If a payment hint like 'Visa ending in 4242' appears in an email, that string is stored verbatim. The full PAN is never available to us." />
          <Row label="Your passphrase" value="Lighthouse hashes a verifier with argon2id and stores the verifier. The passphrase itself never touches disk." />
        </Section>

        <Section
          title="If you change your mind"
          icon={<ShieldAlert size={14} className="text-lh-rose" />}
        >
          <Row
            label="Wipe everything"
            value={
              <>
                Stop the server and{' '}
                <code className="text-lh-fore px-1 py-0.5 bg-lh-line rounded font-mono text-2xs">
                  rm {settings.data?.db_path ?? '~/.lighthouse/lighthouse.db'}
                </code>
                . Done. There's no "delete my account" button because there's
                no account.
              </>
            }
          />
          <Row
            label="Revoke Gmail"
            value={
              <>
                Visit{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noreferrer"
                  className="text-lh-coral hover:text-lh-coralDeep"
                >
                  myaccount.google.com/permissions
                </a>{' '}
                and remove Lighthouse. The encrypted token in your DB becomes
                inert.
              </>
            }
          />
        </Section>

        <div className="lh-card p-5 flex items-start gap-3 border-lh-line2">
          <Eye size={14} className="text-lh-mute mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-medium text-lh-fore mb-1">Audit it yourself</div>
            <div className="text-2xs text-lh-mute leading-relaxed">
              The full source is at{' '}
              <a
                href="https://github.com/vnmoorthy/Lighthouse"
                className="text-lh-coral hover:text-lh-coralDeep"
                target="_blank"
                rel="noreferrer"
              >
                github.com/vnmoorthy/Lighthouse
              </a>
              . Network calls live in{' '}
              <code className="text-lh-fore px-1 py-0.5 bg-lh-line rounded font-mono text-2xs">
                packages/core/src/gmail/
              </code>{' '}
              and{' '}
              <code className="text-lh-fore px-1 py-0.5 bg-lh-line rounded font-mono text-2xs">
                packages/core/src/llm/
              </code>
              . Greppable in five minutes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="lh-card overflow-hidden">
      <div className="px-5 py-3 border-b border-lh-line/40 flex items-center gap-2">
        {icon}
        <div className="text-sm font-semibold text-lh-fore tracking-snug">{title}</div>
      </div>
      <div className="divide-y divide-lh-line/30">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="px-5 py-3 grid grid-cols-[180px_1fr] gap-4 items-start">
      <div className="lh-eyebrow text-[10px]">{label}</div>
      <div className={`text-xs leading-relaxed ${mono ? 'font-mono text-lh-fore/90' : 'text-lh-fore/85'}`}>
        {value}
      </div>
    </div>
  );
}
