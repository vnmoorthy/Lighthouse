import { useQuery } from '@tanstack/react-query';
import { api, type SummaryResponse } from '../lib/api';
import PageHeader from '../components/PageHeader';
import KpiCard from '../components/KpiCard';
import SpendChart from '../components/SpendChart';
import TopMerchantsBar from '../components/TopMerchantsBar';
import AlertsList from '../components/AlertsList';
import { fmtMoney } from '../lib/format';
import { Wallet, Repeat, BellRing, TrendingUp } from 'lucide-react';

export default function OverviewPage() {
  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: () => api<SummaryResponse>('/api/summary'),
  });

  if (summary.isLoading) {
    return (
      <div>
        <PageHeader title="Overview" />
        <div className="p-8 text-sm text-lh-mute">Loading…</div>
      </div>
    );
  }
  if (summary.error || !summary.data) {
    return (
      <div>
        <PageHeader title="Overview" />
        <div className="p-8 text-sm text-rose-300">
          Could not load summary. The API may not be running.
        </div>
      </div>
    );
  }
  const k = summary.data.kpis;
  const counts = summary.data.email_processing;
  const totalEmails = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="The state of your money, derived from your inbox alone — never your bank."
      />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Last 30 days"
            value={fmtMoney(k.last_30d_cents)}
            hint="Sum of receipts"
            icon={<Wallet size={14} className="text-lh-mute" />}
          />
          <KpiCard
            label="Active subscriptions"
            value={k.active_subscriptions}
            hint={`${k.trial_subscriptions} on trial`}
            icon={<Repeat size={14} className="text-lh-mute" />}
          />
          <KpiCard
            label="Monthly subs"
            value={fmtMoney(k.monthly_subscription_cost_cents)}
            hint={`${fmtMoney(k.annual_run_rate_cents)} / yr run rate`}
            icon={<TrendingUp size={14} className="text-lh-mute" />}
          />
          <KpiCard
            label="Open alerts"
            value={k.open_alerts}
            hint={k.open_alerts > 0 ? 'Worth a look' : 'All clear'}
            icon={<BellRing size={14} className="text-lh-mute" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SpendChart data={summary.data.monthly_spend} />
          </div>
          <div>
            <TopMerchantsBar data={summary.data.top_merchants} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="text-sm font-medium mb-2 px-1">Recent alerts</div>
            <AlertsList compact />
          </div>
          <div>
            <div className="lh-card p-5">
              <div className="text-sm font-medium">Inbox health</div>
              <div className="text-xs text-lh-mute mb-3">{totalEmails.toLocaleString()} emails processed</div>
              <div className="space-y-2 text-sm">
                {(
                  [
                    ['done', 'Extracted', 'bg-emerald-500/40'],
                    ['classified', 'Classified', 'bg-cyan-500/40'],
                    ['pending', 'Pending', 'bg-amber-500/40'],
                    ['skipped', 'Skipped', 'bg-slate-500/40'],
                    ['error', 'Error', 'bg-rose-500/40'],
                  ] as const
                ).map(([k, label, color]) => {
                  const v = counts[k] ?? 0;
                  const pct = totalEmails > 0 ? (v / totalEmails) * 100 : 0;
                  return (
                    <div key={k}>
                      <div className="flex items-center justify-between text-xs">
                        <span>{label}</span>
                        <span className="tabular-nums text-lh-mute">{v}</span>
                      </div>
                      <div className="h-1.5 rounded bg-lh-line/60 overflow-hidden mt-1">
                        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
