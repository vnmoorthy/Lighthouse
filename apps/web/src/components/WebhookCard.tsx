/**
 * Webhook + native notifications widget.
 *
 * One file because they share the same "alerts pipeline" mental model:
 * webhook = arbitrary URL, native = OS toast.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiPost } from '../lib/api';
import { CheckCircle2, Send } from 'lucide-react';

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
    </div>
  );
}
