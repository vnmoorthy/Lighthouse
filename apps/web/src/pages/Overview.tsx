import { useQuery } from '@tanstack/react-query';
import { api, type SummaryResponse } from '../lib/api';
import PageHeader from '../components/PageHeader';
import KpiCard from '../components/KpiCard';
import SpendChart from '../components/SpendChart';
import TopMerchantsBar from '../components/TopMerchantsBar';
import AlertsList from '../components/AlertsList';
import { fmtMoney } from '../lib/format';
import { Wallet, Repeat, BellRing, TrendingUp } from 'lucide-react';

function pct(curr: number, prev: number): number {
  if (!prev) return 0;
  return ((curr - prev) / prev) * 100;
}

export default function OverviewPage() {
  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: () => api<SummaryResponse>('/api/summary'),
  });

  if (summary.isLoading) {
    return (
      <div>
        <PageHeader title="Overview" />
        <div className="p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="lh-card p-5">
              <div className="lh-skeleton h-3 w-20 mb-4" />
              <div className="lh-skeleton h-8 w-3/4 mb-2" />
              <div className="lh-skeleton h-3 w-1/2" />
            </div>
          ))}
        </div>
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
  const months = summary.data.monthly_spend;
  const monthlyTrend = months.map((m) => m.total_cents);
  const last = months[months.length - 1]?.total_cents ?? 0;
  const prev = months[months.length - 2]?.total_cents ?? 0;
  const lastDelta = pct(last, prev);

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title="Overview"
        description="The state of your money, derived from your inbox alone — never your bank."
      />
      <div className="p-8 space-y-6">
        {/* KPI grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Last 30 days"
            value={fmtMoney(k.last_30d_cents)}
            hint="Sum of receipts"
            trend={monthlyTrend}
            deltaPct={lastDelta}
            invertDelta
            icon={<Wallet size={14} strokeWidth={1.75} />}
            accent="gold"
          />
          <KpiCard
            label="Active subscriptions"
            value={k.active_subscriptions}
            hint={k.trial_subscriptions > 0 ? `${k.trial_subscriptions} on trial` : 'none on trial'}
            icon={<Repeat size={14} strokeWidth={1.75} />}
            accent="mint"
          />
          <KpiCard
            label="Monthly subs"
            value={fmtMoney(k.monthly_subscription_cost_cents)}
            hint={`${fmtMoney(k.annual_run_rate_cents)} / yr run rate`}
            icon={<TrendingUp size={14} strokeWidth={1.75} />}
            accent="azure"
          />
          <KpiCard
            label="Open alerts"
            value={k.open_alerts}
            hint={k.open_alerts > 0 ? 'Worth a look' : 'All clear'}
            icon={<BellRing size={14} strokeWidth={1.75} />}
            accent={k.open_alerts > 0 ? 'rose' : 'mint'}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SpendChart data={summary.data.monthly_spend} />
          </div>
          <div>
            <TopMerchantsBar data={summary.data.top_merchants} />
          </div>
        </div>

        {/* Alerts + inbox health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="flex items-baseline justify-between mb-3 px-1">
              <div className="lh-eyebrow">Recent alerts</div>
              {k.open_alerts > 0 ? (
                <a href="/alerts" className="text-2xs text-lh-coral hover:text-lh-coralDeep transition-colors">
                  View all →
                </a>
              ) : null}
            </div>
            <AlertsList compact />
          </div>
          <div>
            <div className="lh-card p-5">
              <div className="flex items-baseline justify-between mb-1">
                <div className="lh-eyebrow">Inbox health</div>
                <div className="text-2xs text-lh-mute lh-num">{totalEmails.toLocaleString()} processed</div>
              </div>
              <div className="text-base font-semibold mt-1 mb-4 text-lh-fore">
                {Math.round(((counts.done ?? 0) / Math.max(1, totalEmails)) * 100)}% extracted
              </div>
              <div className="space-y-2.5">
                {(
                  [
                    ['done', 'Extracted', '#74c997'],
                    ['skipped', 'Skipped', '#8a91a0'],
                    ['pending', 'Pending', '#f5b94f'],
                    ['error', 'Error', '#e88a91'],
                  ] as const
                ).map(([k2, label, color]) => {
                  const v = counts[k2] ?? 0;
                  const p = totalEmails > 0 ? (v / totalEmails) * 100 : 0;
                  return (
                    <div key={k2}>
                      <div className="flex items-center justify-between text-2xs mb-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                          <span className="text-lh-mute">{label}</span>
                        </span>
                        <span className="lh-num text-lh-fore/90">{v.toLocaleString()}</span>
                      </div>
                      <div className="h-[3px] rounded-full bg-lh-line/60 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-spring"
                          style={{ width: `${p}%`, background: color, opacity: 0.7 }}
                        />
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
