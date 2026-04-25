import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiPost, type AlertItem } from '../lib/api';
import { fmtMoney, fmtRelative, fmtDate, alertColor } from '../lib/format';
import { AlertTriangle, BellRing, Sparkles, Repeat, X } from 'lucide-react';

const TYPE_LABEL: Record<string, string> = {
  trial_ending: 'Trial ending',
  price_increase: 'Price change',
  new_subscription: 'New subscription',
  duplicate_charge: 'Duplicate charge',
};

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'trial_ending':     return <BellRing size={16} className="text-amber-300" />;
    case 'price_increase':   return <AlertTriangle size={16} className="text-rose-300" />;
    case 'new_subscription': return <Sparkles size={16} className="text-emerald-300" />;
    case 'duplicate_charge': return <Repeat size={16} className="text-violet-300" />;
    default: return null;
  }
}

function alertText(a: AlertItem): string {
  const p = a.payload;
  switch (a.type) {
    case 'trial_ending': {
      const days = Number(p.days_until_end ?? 0);
      const m = String(p.merchant ?? 'Trial');
      return `${m} trial ends in ${days} day${days === 1 ? '' : 's'} (then ${fmtMoney(
        Number(p.amount_cents ?? 0),
        String(p.currency ?? 'USD'),
      )}).`;
    }
    case 'price_increase': {
      const oldA = Number(p.old_amount_cents ?? 0);
      const newA = Number(p.new_amount_cents ?? 0);
      const cur = String(p.currency ?? 'USD');
      const dir = String(p.direction ?? 'increase');
      return `${String(p.merchant ?? '')} price ${dir}: ${fmtMoney(oldA, cur)} → ${fmtMoney(
        newA,
        cur,
      )}.`;
    }
    case 'new_subscription':
      return `New subscription detected: ${String(p.merchant ?? '')} · ${fmtMoney(
        Number(p.amount_cents ?? 0),
        String(p.currency ?? 'USD'),
      )} / ${String(p.billing_cycle ?? '')}.`;
    case 'duplicate_charge': {
      const a1 = p.receipt_a as { amount_cents: number; date: number };
      const a2 = p.receipt_b as { amount_cents: number; date: number };
      return `Possible duplicate at ${String(p.merchant ?? '')}: ${fmtMoney(
        a1.amount_cents,
      )} on ${fmtDate(a1.date)} and ${fmtMoney(a2.amount_cents)} on ${fmtDate(a2.date)}.`;
    }
    default:
      return JSON.stringify(p);
  }
}

export default function AlertsList({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api<{ alerts: AlertItem[] }>('/api/alerts'),
  });
  const dismiss = useMutation({
    mutationFn: (id: number) => apiPost(`/api/alerts/${id}/dismiss`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alerts'] });
      void qc.invalidateQueries({ queryKey: ['summary'] });
      void qc.invalidateQueries({ queryKey: ['summary-mini'] });
    },
  });

  if (q.isLoading) return <div className="lh-card p-6 text-sm text-lh-mute">Loading alerts…</div>;
  const alerts = q.data?.alerts ?? [];
  if (alerts.length === 0) {
    return (
      <div className="lh-card p-6">
        <div className="text-sm font-medium">All clear</div>
        <div className="text-sm text-lh-mute mt-1">
          No open alerts. We'll notice trial endings and price changes the next time you sync.
        </div>
      </div>
    );
  }

  const list = compact ? alerts.slice(0, 4) : alerts;
  return (
    <div className="space-y-2">
      {list.map((a) => (
        <div
          key={a.id}
          className={`flex items-start gap-3 border rounded-xl p-4 ${alertColor(a.type)}`}
        >
          <div className="mt-0.5">
            <TypeIcon type={a.type} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-lh-mute">
              {TYPE_LABEL[a.type] ?? a.type}
              <span className="ml-2 text-lh-mute/70 normal-case">{fmtRelative(a.created_at)}</span>
            </div>
            <div className="text-sm mt-1">{alertText(a)}</div>
          </div>
          <button
            type="button"
            onClick={() => dismiss.mutate(a.id)}
            className="text-lh-mute hover:text-lh-fore p-1 rounded"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
