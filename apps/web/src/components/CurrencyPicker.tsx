/**
 * Display-currency picker.
 *
 * Receipts are stored in their native currency forever; this dropdown
 * just controls what the dashboard shows. Conversion uses static rates
 * (overridable via LIGHTHOUSE_FX_<CCY> env vars).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiPost } from '../lib/api';

export default function CurrencyPicker() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['display-currency'],
    queryFn: () => api<{ display: string; supported: string[] }>('/api/currency'),
  });
  const set = useMutation({
    mutationFn: (ccy: string) => apiPost('/api/currency', { ccy }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['display-currency'] });
      void qc.invalidateQueries({ queryKey: ['summary'] });
    },
  });
  if (q.isLoading || !q.data) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1">
        <div className="text-sm text-lh-fore">Display currency</div>
        <div className="text-2xs text-lh-mute mt-0.5 leading-relaxed">
          Receipts stay in their native currency. The dashboard converts to your
          pick using static rates. Override per-currency rate via{' '}
          <code className="text-lh-fore px-1 py-0.5 bg-lh-line rounded font-mono text-2xs">
            LIGHTHOUSE_FX_EUR=0.92
          </code>{' '}
          in your <code className="text-lh-fore px-1 py-0.5 bg-lh-line rounded font-mono text-2xs">.env</code>.
        </div>
      </div>
      <select
        className="lh-select shrink-0"
        value={q.data.display}
        onChange={(e) => set.mutate(e.target.value)}
      >
        {q.data.supported.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
