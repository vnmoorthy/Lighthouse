import { useQuery } from '@tanstack/react-query';
import { api, type SummaryResponse } from '../lib/api';
import PageHeader from '../components/PageHeader';
import KpiCard from '../components/KpiCard';
import SpendChart from '../components/SpendChart';
import TopMerchantsBar from '../components/TopMerchantsBar';
import CategoryBreakdown from '../components/CategoryBreakdown';
import { BudgetsDisplay } from '../components/BudgetsCard';
import SpendingPatterns from '../components/SpendingPatterns';
import MoneyFlowSankey from '../components/MoneyFlowSankey';
import InsightsRow from '../components/InsightsRow';
import AlertsList from '../components/AlertsList';
import { fmtMoney } from '../lib/format';
import { Wallet, Repeat, BellRing, TrendingUp, PiggyBank, ArrowDownRight, Percent } from 'lucide-react';

function pct(curr: number, prev: number): number {
  if (!prev) return 0;
  return ((curr - prev) / prev) * 100;
}

function YoYCard({
  yoy,
}: {
  yoy: { month: string; this_year_cents: number; last_year_cents: number }[];
}) {
  if (!yoy || yoy.length === 0) return null;
  const totalThis = yoy.reduce((acc, m) => acc + m.this_year_cents, 0);
  const totalLast = yoy.reduce((acc, m) => acc + m.last_year_cents, 0);
  const delta = pct(totalThis, totalLast);
  const isUp = delta > 0;
  // Bar chart inline using divs, two-bar comparison per month.
  const max = Math.max(...yoy.flatMap((m) => [m.this_year_cents, m.last_year_cents]));

  return (
    <div className="lh-card p-5 h-[340px] flex flex-col">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="lh-eyebrow">Year over year</div>
          <div className="text-base font-semibold mt-1 text-lh-fore">12-month rolling spend</div>
        </div>
        <div className="text-right">
          <div className="lh-eyebrow text-[10px]">12-mo change</div>
          <div
            className={`lh-num text-base font-semibold mt-0.5 ${isUp ? 'text-lh-rose' : 'text-lh-mint'}`}
          >
            {isUp ? '+' : ''}
            {delta.toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-end gap-1 overflow-hidden">
        {yoy.map((m) => {
          const tHeight = max > 0 ? (m.this_year_cents / max) * 100 : 0;
          const lHeight = max > 0 ? (m.last_year_cents / max) * 100 : 0;
          const label = m.month.slice(5); // 'MM'
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
              <div className="flex items-end justify-center gap-0.5 h-full w-full">
                <div
                  className="flex-1 rounded-t-sm bg-lh-line2/60 group-hover:bg-lh-line2 transition-colors"
                  style={{ height: `${lHeight}%` }}
                  title={`Last yr · ${m.month}`}
                />
                <div
                  className="flex-1 rounded-t-sm bg-gradient-to-t from-lh-coral to-lh-gold group-hover:from-lh-coralDeep transition-colors"
                  style={{ height: `${tHeight}%` }}
                  title={`This yr · ${m.month}`}
                />
              </div>
              <div className="text-[9px] text-lh-mute lh-num">{label}</div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-2xs text-lh-mute mt-2">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-gradient-to-t from-lh-coral to-lh-gold" /> This year
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-lh-line2" /> Last year
        </span>
      </div>
    </div>
  );
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

        {/* Income-derived KPIs (only render when income data exists). */}
        {k.income_30d_cents != null && k.income_30d_cents > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Income · 30d"
              value={fmtMoney(k.income_30d_cents)}
              hint="Trailing window"
              icon={<PiggyBank size={14} strokeWidth={1.75} />}
              accent="mint"
            />
            <KpiCard
              label="Net · 30d"
              value={fmtMoney(k.net_30d_cents ?? 0)}
              hint={(k.net_30d_cents ?? 0) >= 0 ? 'You saved' : 'Outspending'}
              icon={<ArrowDownRight size={14} strokeWidth={1.75} />}
              accent={(k.net_30d_cents ?? 0) >= 0 ? 'mint' : 'rose'}
            />
            <KpiCard
              label="Savings rate"
              value={
                k.savings_rate_30d != null
                  ? `${(k.savings_rate_30d * 100).toFixed(0)}%`
                  : '—'
              }
              hint="of income kept"
              icon={<Percent size={14} strokeWidth={1.75} />}
              accent={(k.savings_rate_30d ?? 0) >= 0.2 ? 'mint' : 'gold'}
            />
            <KpiCard
              label="Subs as % of income"
              value={
                k.subscriptions_as_pct_of_income != null
                  ? `${(k.subscriptions_as_pct_of_income * 100).toFixed(1)}%`
                  : '—'
              }
              hint="Monthly recurring vs income"
              icon={<Repeat size={14} strokeWidth={1.75} />}
              accent="violet"
            />
          </div>
        ) : null}

        {/* Insights */}
        <InsightsRow />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SpendChart data={summary.data.monthly_spend} />
          </div>
          <div>
            <TopMerchantsBar data={summary.data.top_merchants} />
          </div>
        </div>

        {/* Category breakdown + YoY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CategoryBreakdown data={summary.data.categories} />
          </div>
          <div>
            <YoYCard yoy={summary.data.year_over_year} />
          </div>
        </div>

        {/* Budgets + spending patterns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <BudgetsDisplay />
          </div>
          <div className="lg:col-span-2">
            <SpendingPatterns />
          </div>
        </div>

        {/* Money flow sankey */}
        <MoneyFlowSankey />

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
