/**
 * Webhook + native notifications widget.
 *
 * One file because they share the same "alerts pipeline" mental model:
 * webhook = arbitrary URL, native = OS toast.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiPost } from '../lib/api';
import { CheckCircle2, Send, AlertCircle, Clock } from 'lucide-react';
import { fmtRelative } from '../lib/format';

export default function WebhookCard() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['webhook'],
    queryFn: () => api<{ url: string | null }>('/api/webhook'),
  });
  const [url, setUrl] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [testFlash, setTestFlash] = useState(false);

  useEffect(() => {
    if (q.data?.url) setUrl(q.data.url);
  }, [q.data?.url]);

  const save = useMutation({
    mutationFn: (next: string | null) => apiPost('/api/webhook', { url: next }),
    onSuccess: () => {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      void qc.invalidateQueries({ queryKey: ['webhook'] });
    },
  });
  const sendTest = useMutation({
    mutationFn: () => apiPost('/api/webhook/test'),
    onSuccess: () => {
      setTestFlash(true);
      setTimeout(() => setTestFlash(false), 1800);
    },
  });

  return (
    <div className="space-y-3">
      <input
        type="url"
        className="lh-input w-full font-mono text-2xs"
        placeholder="https://hooks.slack.com/services/…  or  https://ntfy.sh/your-topic"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="text-2xs text-lh-mute">
          POSTs a JSON alert payload to this URL whenever any alert is created.
          Fire-and-forget; failures are logged but never block sync.
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {testFlash ? (
            <span className="text-2xs text-emerald-300 inline-flex items-center gap-1">
              <CheckCircle2 size={11} /> sent
            </span>
          ) : null}
          <button
            type="button"
            className="lh-btn !py-1 !px-2 text-2xs"
            disabled={!q.data?.url || sendTest.isPending}
            onClick={() => sendTest.mutate()}
          >
            <Send size={11} /> Send test
          </button>
          <button
            type="button"
            className="lh-btn-primary !py-1 !px-2 text-2xs"
            disabled={save.isPending}
            onClick={() => save.mutate(url || null)}
          >
            {savedFlash ? (
              <>
                <CheckCircle2 size={11} /> saved
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>

      <DeliveryLog />
    </div>
  );
}

interface Delivery {
  id: number;
  url: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  last_status_code: number | null;
  last_error: string | null;
  next_attempt_at: number | null;
  created_at: number;
  updated_at: number;
}

function DeliveryLog() {
  const q = useQuery({
    queryKey: ['webhook-deliveries'],
    queryFn: () => api<{ deliveries: Delivery[] }>('/api/webhook/deliveries'),
    refetchInterval: 5_000,
  });
  const list = q.data?.deliveries ?? [];
  if (list.length === 0) return null;
  return (
    <div className="lh-card !rounded-md overflow-hidden">
      <div className="px-3 py-2 lh-eyebrow border-b border-lh-line/50 flex items-center justify-between">
        <span>Recent deliveries</span>
        <span className="text-2xs text-lh-mute">auto-refreshing</span>
      </div>
      <div className="divide-y divide-lh-line/30">
        {list.slice(0, 6).map((d) => (
          <div key={d.id} className="px-3 py-2 flex items-center gap-2 text-2xs">
            <StatusIcon status={d.status} />
            <span className="text-lh-fore">
              {d.status === 'pending'
                ? `pending (attempt ${d.attempts + 1})`
                : d.status === 'success'
                  ? `success ${d.last_status_code ?? ''}`.trim()
                  : `failed${d.last_status_code ? ` ${d.last_status_code}` : ''}`}
            </span>
            <span className="text-lh-mute ml-auto">{fmtRelative(d.updated_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: Delivery['status'] }) {
  if (status === 'success')
    return <CheckCircle2 size={11} className="text-emerald-300 shrink-0" />;
  if (status === 'failed')
    return <AlertCircle size={11} className="text-rose-300 shrink-0" />;
  return <Clock size={11} className="text-amber-300 shrink-0" />;
}
