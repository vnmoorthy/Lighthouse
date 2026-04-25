import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  apiPost,
  type SettingsResponse,
  type SyncRunDetail,
} from '../lib/api';
import PageHeader from '../components/PageHeader';
import { fmtRelative } from '../lib/format';
import { RefreshCw, Database, Cpu, AtSign } from 'lucide-react';

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

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Local config. Nothing on this page leaves your machine."
      />
      <div className="p-8 space-y-4 max-w-3xl">
        {settings.isLoading || !settings.data ? (
          <div className="lh-card p-6 text-sm text-lh-mute">Loading…</div>
        ) : (
          <>
            <div className="lh-card p-5 space-y-3">
              <div className="text-sm font-medium">Account</div>
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
                icon={<Cpu size={14} />}
                label="LLM"
                value={`${settings.data.llm_provider} · ${settings.data.llm_model}`}
              />
              <Field
                icon={<RefreshCw size={14} />}
                label="Last sync"
                value={
                  settings.data.last_sync_at
                    ? fmtRelative(Number.parseInt(settings.data.last_sync_at, 10))
                    : 'never'
                }
              />
            </div>

            <div className="lh-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Sync now</div>
                  <div className="text-xs text-lh-mute mt-1">
                    Fetch new mail and run the LLM extractors. This may cost a few cents at the
                    Anthropic API depending on inbox volume.
                  </div>
                </div>
                <button
                  type="button"
                  className="lh-btn-primary"
                  onClick={() => sync.mutate()}
                  disabled={sync.isPending || (run.data && !run.data.finished_at)}
                >
                  <RefreshCw
                    size={14}
                    className={sync.isPending || (run.data && !run.data.finished_at) ? 'animate-spin' : ''}
                  />
                  {sync.isPending || (run.data && !run.data.finished_at) ? 'Syncing…' : 'Run sync'}
                </button>
              </div>
              {run.data ? (
                <div className="text-xs text-lh-mute font-mono pt-3 border-t border-lh-line/40">
                  run #{run.data.id} · status {run.data.status} ·{' '}
                  fetched {run.data.emails_fetched.toLocaleString()} ·{' '}
                  processed {run.data.emails_processed.toLocaleString()}
                </div>
              ) : null}
            </div>

            <div className="lh-card p-5 space-y-3 border-rose-500/20">
              <div className="text-sm font-medium text-rose-300">Danger zone</div>
              <div className="text-xs text-lh-mute">
                The local database stores your inbox excerpt and extracted data. To wipe it
                completely, stop the server and delete the file at{' '}
                <code className="text-lh-fore">{settings.data.db_path}</code>. To re-key the
                vault passphrase, run <code className="text-lh-fore">npm run setup -- --rekey</code>.
              </div>
            </div>
          </>
        )}
      </div>
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
      <div className="mt-0.5 text-lh-mute">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-lh-mute">{label}</div>
        <div className={`text-sm truncate ${mono ? 'font-mono text-lh-fore/90' : ''}`}>{value}</div>
      </div>
    </div>
  );
}
