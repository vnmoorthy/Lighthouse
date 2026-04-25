import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiPost, type AlertItem } from '../lib/api';
import { fmtMoney, fmtRelative, fmtDate } from '../lib/format';
import { AlertTriangle, BellRing, Sparkles, Repeat, X, CheckCircle2 } from 'lucide-react';

const TYPE_LABEL: Record<string, string> = {
  trial_ending: 'Trial ending',
  price_increase: 'Price change',
  new_subscription: 'New subscription',
  duplicate_charge: 'Duplicate charge',
};

const TYPE_TONE: Record<string, { ring: string; tag: string; icon: string; bg: string }> = {
  trial_ending: {
    ring: 'border-amber-500/25',
    tag: 'text-amber-300 bg-amber-500/10',
    icon: 'text-amber-300',
    bg: 'bg-amber-500/[0.03]',
  },
  price_increase: {
    ring: 'border-rose-500/25',
    tag: 'text-rose-300 bg-rose-500/10',
    icon: 'text-rose-300',
    bg: 'bg-rose-500/[0.03]',
  },
  new_subscription: {
    ring: 'border-emerald-500/25',
    tag: 'text-emerald-300 bg-emerald-500/10',
    icon: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.03]',
  },
  duplicate_charge: {
    ring: 'border-violet-500/25',
    tag: 'text-violet-300 bg-violet-500/10',
    icon: 'text-violet-300',
    bg: 'bg-violet-500/[0.03]',
  },
};

function TypeIcon({ type }: { type: string }) {
  const cls = TYPE_TONE[type]?.icon ?? '';
  switch (type) {
    case 'trial_ending':     return <BellRing size={16} className={cls} strokeWidth={2} />;
    case 'price_increase':   return <AlertTriangle size={16} className={cls} strokeWidth={2} />;
    case 'new_subscription': return <Sparkles size={16} className={cls} strokeWidth={2} />;
    case 'duplicate_charge': return <Repeat size={16} className={cls} strokeWidth={2} />;
    default: return null;
  }
}

function alertText(a: AlertItem): { headline: string; meta?: string } {
  const p = a.payload;
  switch (a.type) {
    case 'trial_ending': {
      const days = Number(p.days_until_end ?? 0);
      const m = String(p.merchant ?? 'Trial');
      const plan = p.plan_name ? `${m} · ${p.plan_name}` : m;
      const amt = fmtMoney(Number(p.amount_cents ?? 0), String(p.currency ?? 'USD'));
      return {
        headline: `${plan} trial ends in ${days} day${days === 1 ? '' : 's'}.`,
        meta: `Then ${amt} / month. ${p.trial_end_date ? `Ends ${fmtDate(Number(p.trial_end_date))}.` : ''}`,
      };
    }
    case 'price_increase': {
      const oldA = Number(p.old_amount_cents ?? 0);
      const newA = Number(p.new_amount_cents ?? 0);
      const cur = String(p.currency ?? 'USD');
      const dir = String(p.direction ?? 'increase');
      const m = String(p.merchant ?? '');
      const pct = oldA > 0 ? ((newA - oldA) / oldA) * 100 : 0;
      return {
        headline: `${m} ${dir}: ${fmtMoney(oldA, cur)} → ${fmtMoney(newA, cur)}.`,
        meta: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}% vs. previous charges.`,
      };
    }
    case 'new_subscription':
      return {
        headline: `New subscription detected: ${String(p.merchant ?? '')}.`,
        meta: `${fmtMoney(Number(p.amount_cents ?? 0), String(p.currency ?? 'USD'))} / ${p.billing_cycle}${p.plan_name ? ` · ${p.plan_name}` : ''}`,
      };
    case 'duplicate_charge': {
      const a1 = p.receipt_a as { amount_cents: number; date: number };
      const a2 = p.receipt_b as { amount_cents: number; date: number };
      return {
        headline: `Possible duplicate at ${String(p.merchant ?? '')}.`,
        meta: `${fmtMoney(a1.amount_cents)} on ${fmtDate(a1.date)} and ${fmtMoney(a2.amount_cents)} on ${fmtDate(a2.date)}.`,
      };
    }
    default:
      return { headline: JSON.stringify(p) };
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

  if (q.isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="lh-card p-5 flex items-start gap-3">
            <div className="lh-skeleton w-4 h-4 rounded-full mt-1" />
            <div className="flex-1 space-y-2">
              <div className="lh-skeleton h-3 w-24" />
              <div className="lh-skeleton h-4 w-3/4" />
              <div className="lh-skeleton h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const alerts = q.data?.alerts ?? [];
  if (alerts.length === 0) {
    return (
      <div className="lh-card p-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mb-3">
          <CheckCircle2 size={20} className="text-emerald-300" strokeWidth={1.75} />
        </div>
        <div className="text-sm font-medium text-lh-fore">All clear</div>
        <div className="text-xs text-lh-mute mt-1 max-w-sm mx-auto leading-relaxed">
          No open alerts. The next sync will surface fresh trial endings, price changes, or duplicates.
        </div>
      </div>
    );
  }

  const list = compact ? alerts.slice(0, 4) : alerts;
  return (
    <div className="space-y-2">
      {list.map((a) => {
        const { headline, meta } = alertText(a);
        const tone = TYPE_TONE[a.type] ?? { ring: 'border-lh-line', tag: '', icon: '', bg: '' };
        return (
          <div
            key={a.id}
            className={`flex items-start gap-3 border ${tone.ring} ${tone.bg} rounded-xl p-4 transition-all duration-200 hover:bg-lh-slab2/40 group`}
          >
            <div className="mt-0.5 shrink-0">
              <TypeIcon type={a.type} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-2xs font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${tone.tag}`}>
                  {TYPE_LABEL[a.type] ?? a.type}
                </span>
                <span className="text-2xs text-lh-mute">{fmtRelative(a.created_at)}</span>
              </div>
              <div className="text-sm text-lh-fore leading-snug">{headline}</div>
              {meta ? <div className="text-xs text-lh-mute mt-0.5 lh-num">{meta}</div> : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss.mutate(a.id)}
              className="lh-btn-icon opacity-50 group-hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
