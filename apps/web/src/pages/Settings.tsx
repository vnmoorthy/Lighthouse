import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  apiPost,
  type SettingsResponse,
  type SyncRunDetail,
} from '../lib/api';
import PageHeader from '../components/PageHeader';
import { fmtRelative, fmtDate } from '../lib/format';
import {
  RefreshCw,
  Database,
  Cpu,
  AtSign,
  ShieldAlert,
  ShieldCheck,
  Lock,
  HardDrive,
  Globe,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { useTheme, type Theme } from '../lib/theme';
import CustomAlertsCard from '../components/CustomAlertsCard';
import { BudgetsEdit } from '../components/BudgetsCard';

export default function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<SettingsResponse>('/api/settings'),
  });
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const sync = useMutation({
    mutationFn: () => apiPost<{ id: number }>('/api/sync'),
    onSuccess: (r) => {
      setActiveRunId(r.id);
      void qc.invalidateQueries({ queryKey: ['summary'] });
    },
  });

  const run = useQuery({
    queryKey: ['sync-run', activeRunId],
    queryFn: () => api<SyncRunDetail>(`/api/sync/${activeRunId}`),
    enabled: activeRunId != null,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (data && data.finished_at) return false;
      return 1500;
    },
  });

  const syncing = sync.isPending || (run.data && !run.data.finished_at);

  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Local config. Nothing on this page leaves your machine."
      />
      <div className="p-8 space-y-5 max-w-3xl">
        {settings.isLoading || !settings.data ? (
          <>
            <div className="lh-skeleton h-32 w-full" />
            <div className="lh-skeleton h-24 w-full" />
          </>
        ) : (
          <>
            {/* Account */}
            <SectionCard
              title="Account"
              description="The Gmail account currently connected and where Lighthouse stores its files."
            >
              <Field
                icon={<AtSign size={14} />}
                label="Connected Gmail"
                value={settings.data.user ?? '— (not connected)'}
              />
              <Field
                icon={<Database size={14} />}
                label="Database file"
                value={settings.data.db_path}
                mono
              />
              <Field
                icon={<HardDrive size={14} />}
                label="Last sync"
                value={
                  settings.data.last_sync_at
                    ? `${fmtRelative(Number.parseInt(settings.data.last_sync_at, 10))} (${fmtDate(Number.parseInt(settings.data.last_sync_at, 10))})`
                    : 'never'
                }
              />
            </SectionCard>

            {/* Appearance */}
            <SectionCard
              title="Appearance"
              description="Lighthouse follows your OS appearance by default. Override here if you'd like."
            >
              <ThemeSwitch />
            </SectionCard>

            {/* Provider */}
            <SectionCard
              title="LLM provider"
              description="Where structured-extraction calls are sent. Cloud is faster; local is private and free."
            >
              <Field
                icon={<Cpu size={14} />}
                label="Provider"
                value={settings.data.llm_provider}
              />
              <Field
                icon={<Globe size={14} />}
                label="Model"
                value={settings.data.llm_model}
                mono
              />
              <Field
                icon={<ShieldCheck size={14} />}
                label="API binding"
                value={`${settings.data.api.host}:${settings.data.api.port} (localhost only)`}
                mono
              />
            </SectionCard>

            {/* Budgets */}
            <SectionCard
              title="Budgets"
              description="Set a monthly cap per category. We'll alert you when you cross 80%."
            >
              <BudgetsEdit />
            </SectionCard>

            {/* Custom alerts */}
            <SectionCard
              title="Custom alerts"
              description="Watch for spending patterns that aren't built-in. Each rule fires once per 30 days while the condition holds."
            >
              <CustomAlertsCard />
            </SectionCard>

            {/* Sync */}
            <SectionCard
              title="Sync"
              description="Pull new mail and run the LLM extractors. Re-syncing is essentially free thanks to content-hash caching."
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm text-lh-fore">Sync your inbox now</div>
                  <div className="text-xs text-lh-mute mt-1 max-w-md leading-relaxed">
                    Fetches new mail from Gmail and runs the LLM extractors on anything pending.
                    May incur a few cents in API charges depending on inbox volume and provider.
                  </div>
                </div>
                <button
                  type="button"
                  className="lh-btn-primary shrink-0"
                  onClick={() => sync.mutate()}
                  disabled={syncing ?? false}
                >
                  <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing…' : 'Run sync'}
                </button>
              </div>
              {run.data ? (
                <div className="text-xs text-lh-mute font-mono pt-3 mt-3 border-t border-lh-line/40 lh-num">
                  run #{run.data.id} · {run.data.status} · fetched{' '}
                  <span className="text-lh-fore">{run.data.emails_fetched.toLocaleString()}</span>{' '}
                  · processed{' '}
                  <span className="text-lh-fore">{run.data.emails_processed.toLocaleString()}</span>
                </div>
              ) : null}
            </SectionCard>

            {/* Danger zone */}
            <SectionCard
              title="Danger zone"
              description=""
              tone="danger"
            >
              <div className="space-y-3">
                <DangerRow
                  icon={<Lock size={14} />}
                  title="Re-key the vault"
                  body={
                    <>
                      Change the passphrase that encrypts the Gmail refresh token at rest. Run{' '}
                      <code className="text-lh-fore px-1 py-0.5 bg-lh-line rounded font-mono text-2xs">
                        npm run setup -- --rekey
                      </code>{' '}
                      from the terminal.
                    </>
                  }
                />
                <DangerRow
                  icon={<ShieldAlert size={14} />}
                  title="Wipe all local data"
                  body={
                    <>
                      Stop the server and delete{' '}
                      <code className="text-lh-fore px-1 py-0.5 bg-lh-line rounded font-mono text-2xs">
                        {settings.data.db_path}
                      </code>
                      . This removes every receipt, subscription, and the encrypted Gmail token.
                      Re-running setup will start fresh.
                    </>
                  }
                />
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}

function ThemeSwitch() {
  const [theme, setTheme] = useTheme();
  const opts: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'system', label: 'System', icon: <Monitor size={13} /> },
    { value: 'dark', label: 'Dark', icon: <Moon size={13} /> },
    { value: 'light', label: 'Light', icon: <Sun size={13} /> },
  ];
  return (
    <div className="flex gap-1 bg-lh-paper rounded-md p-1 border border-lh-line w-fit">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setTheme(o.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-2xs font-medium rounded-sm transition-all ${
            theme === o.value
              ? 'bg-lh-line2 text-lh-fore shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]'
              : 'text-lh-mute hover:text-lh-fore'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  tone = 'default',
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <div
      className={[
        'lh-card p-5',
        tone === 'danger' ? 'border-rose-500/20 bg-rose-500/[0.02]' : '',
      ].join(' ')}
    >
      <div className="mb-4">
        <div className={['text-base font-semibold tracking-snug', tone === 'danger' ? 'text-rose-300' : 'text-lh-fore'].join(' ')}>
          {title}
        </div>
        {description ? <div className="text-xs text-lh-mute mt-1 leading-relaxed">{description}</div> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      <div className="mt-1 text-lh-mute">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="lh-eyebrow text-[10px]">{label}</div>
        <div
          className={`text-sm mt-0.5 truncate ${mono ? 'font-mono text-2xs text-lh-fore/90' : 'text-lh-fore'}`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function DangerRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-rose-300">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-lh-fore">{title}</div>
        <div className="text-xs text-lh-mute mt-1 leading-relaxed">{body}</div>
      </div>
    </div>
  );
}
