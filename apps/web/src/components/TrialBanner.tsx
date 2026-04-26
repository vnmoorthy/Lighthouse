/**
 * Persistent trial banner shown at the top of every page when at least
 * one trial is approaching its end date.
 *
 * Only visible if there's a trial ending in <= 14 days.
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BellRing, ArrowRight } from 'lucide-react';
import { api, type SubscriptionListItem } from '../lib/api';
import { fmtMoney } from '../lib/format';

const DAY = 24 * 60 * 60 * 1000;

export default function TrialBanner() {
  const q = useQuery({
    queryKey: ['trial-banner'],
    queryFn: () => api<{ subscriptions: SubscriptionListItem[] }>('/api/subscriptions?status=trial'),
  });
  const subs = q.data?.subscriptions ?? [];
  const now = Date.now();
  const soon = subs
    .filter((s) => s.trial_end_date != null && s.trial_end_date - now <= 14 * DAY)
    .sort((a, b) => (a.trial_end_date ?? 0) - (b.trial_end_date ?? 0));

  if (soon.length === 0) return null;
  const first = soon[0]!;
  const days = Math.max(0, Math.ceil(((first.trial_end_date ?? 0) - now) / DAY));

  return (
    <div className="border-b border-amber-500/20 bg-amber-500/[0.06] backdrop-blur-sm">
      <Link
        to="/alerts"
        className="px-8 py-2.5 flex items-center gap-3 text-sm hover:bg-amber-500/[0.04] transition-colors"
      >
        <BellRing size={14} className="text-amber-300 shrink-0" strokeWidth={2} />
        <div className="flex-1 min-w-0 text-amber-100/90">
          <span className="font-medium text-amber-100">{first.merchant_display_name}</span>
          <span className="mx-1 text-amber-200/60">·</span>
          <span className="text-amber-200/80">
            trial ends in {days} day{days === 1 ? '' : 's'}
          </span>
          <span className="mx-1 text-amber-200/60">·</span>
          <span className="text-amber-200/60 lh-num">
            then {fmtMoney(first.amount_cents, first.currency)}/{first.billing_cycle}
          </span>
          {soon.length > 1 ? (
            <span className="ml-2 text-amber-200/60">
              and {soon.length - 1} more
            </span>
          ) : null}
        </div>
        <ArrowRight size={12} className="text-amber-200/60 shrink-0" />
      </Link>
    </div>
  );
}
