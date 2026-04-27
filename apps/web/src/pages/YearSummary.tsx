/**
 * "Year in review" page at /year/:year (defaults to current year).
 *
 * Designed to be print-stylesheet-friendly — the user can hit ⌘P and
 * get a one-page PDF suitable for sending to an accountant or pinning
 * to a journal entry.
 */
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import MerchantBadge from '../components/MerchantBadge';
import { CATEGORY_LABEL, categoryColor } from '../components/CategoryBreakdown';
import { fmtMoney, fmtMonth } from '../lib/format';

interface YearSummaryResp {
  year: number;
  total_cents: number;
  receipt_count: number;
  monthly: { month: string; total_cents: number; count: number }[];
  top_merchants: { merchant_id: number; display_name: string; total_cents: number; count: number }[];
  categories: { category: string; total_cents: number; count: number }[];
  biggest_day: { day: string; total_cents: number; count: number } | null;
  biggest_month: { month: string; total_cents: number; count: number } | null;
  active_subscriptions_at_year_end: number;
  monthly_subscription_cost_cents: number;
}

export default function YearSummaryPage() {
  const params = useParams();
  const year = Number.parseInt(params.year ?? String(new Date().getFullYear()), 10);
  const q = useQuery({
    queryKey: ['year-summary', year],
    queryFn: () => api<YearSummaryResp>(`/api/year/${year}`),
  });

  function printPage() {
    document.body.classList.add('lh-printing');
    const off = () => {
      document.body.classList.remove('lh-printing');
      window.removeEventListener('afterprint', off);
    };
    window.addEventListener('afterprint', off);
    setTimeout(() => window.print(), 80);
  }

  if (q.isLoading) {
    return (
      <div>
        <PageHeader title={`${year} in review`} />
        <div className="p-8 lh-skeleton h-40 w-full" />
      </div>
    );
  }
  if (!q.data) {
    return (
      <div>
        <PageHeader title={`${year} in review`} />
        <div className="p-8 text-sm text-rose-300">Could not load year summary.</div>
      </div>
    );
  }
  const y = q.data;
  const max = Math.max(1, ...y.monthly.map((m) => m.total_cents));
  const monthMap = new Map(y.monthly.map((m) => [m.month.slice(5), m]));

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link to="/" className="hover:text-lh-fore inline-flex items-center gap-1">
            <ArrowLeft size={11} /> Overview
          </Link>
        }
        title={`${year} in review`}
        description={
          y.receipt_count > 0
            ? `${y.receipt_count.toLocaleString()} receipts totaling ${fmtMoney(y.total_cents)} this year.`
            : `No receipts in ${year} yet.`
        }
        actions={
          <div className="flex items-center gap-2">
            <Link to={`/year/${year - 1}`} className="lh-btn-icon" title={`${year - 1}`}>
              <ChevronLeft size={14} />
            </Link>
            <Link to={`/year/${year + 1}`} className="lh-btn-icon" title={`${year + 1}`}>
              <ChevronRight size={14} />
            </Link>
            <button type="button" className="lh-btn" onClick={printPage}>
              <Printer size={14} /> Save as PDF
            </button>
          </div>
        }
      />

      <div className="p-8 space-y-6 max-w-5xl">
        {/* Hero KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Total spent"     value={fmtMoney(y.total_cents)} />
          <Stat label="Receipts"        value={y.receipt_count.toLocaleString()} />
          <Stat
            label="Biggest month"
            value={y.biggest_month ? fmtMonth(y.biggest_month.month) : '—'}
            sub={y.biggest_month ? fmtMoney(y.biggest_month.total_cents) : undefined}
          />
          <Stat
            label="Biggest day"
            value={y.biggest_day ? new Date(y.biggest_day.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
            sub={y.biggest_day ? fmtMoney(y.biggest_day.total_cents) : undefined}
          />
        </div>

        {/* Monthly bars */}
        <div className="lh-card p-5">
          <div className="lh-eyebrow mb-3">Monthly spend</div>
          <div className="flex items-end gap-2 h-40">
            {Array.from({ length: 12 }).map((_, i) => {
              const ym = String(i + 1).padStart(2, '0');
              const m = monthMap.get(ym);
              const h = m ? (m.total_cents / max) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div
                    className="w-full rounded-t-sm bg-gradient-to-t from-lh-coral to-lh-gold"
                    style={{ height: `${Math.max(2, h)}%` }}
                    title={
                      m
                        ? `${fmtMonth(`${year}-${ym}`)}: ${fmtMoney(m.total_cents)} (${m.count})`
                        : 'no receipts'
                    }
                  />
                  <div className="text-[9px] text-lh-mute lh-num">{ym}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Categories + Top merchants */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lh-card p-5">
            <div className="lh-eyebrow mb-3">Where it went, by category</div>
            <div className="space-y-2">
              {y.categories.slice(0, 8).map((c) => {
                const total = y.total_cents || 1;
                const pct = (c.total_cents / total) * 100;
                return (
                  <div key={c.category}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-sm"
                          style={{ background: categoryColor(c.category) }}
                        />
                        <span className="text-lh-fore">{CATEGORY_LABEL[c.category] ?? c.category}</span>
                      </span>
                      <span className="lh-num text-2xs text-lh-mute">
                        {fmtMoney(c.total_cents)} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 mt-1 rounded-full bg-lh-line/60 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: categoryColor(c.category) }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lh-card p-5">
            <div className="lh-eyebrow mb-3">Top 10 merchants</div>
            <div className="space-y-2.5">
              {y.top_merchants.map((m, i) => (
                <Link
                  key={m.merchant_id}
                  to={`/merchants/${m.merchant_id}`}
                  className="flex items-center gap-3 p-1 -m-1 rounded hover:bg-lh-line/30 transition-colors"
                >
                  <span className="text-2xs text-lh-mute w-3 lh-num">{i + 1}</span>
                  <MerchantBadge name={m.display_name} size="sm" />
                  <span className="text-sm text-lh-fore flex-1 truncate">{m.display_name}</span>
                  <span className="text-xs text-lh-mute lh-num">{fmtMoney(m.total_cents)}</span>
                  <span className="text-2xs text-lh-mute lh-num w-10 text-right">{m.count}×</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Subscription footer */}
        <div className="lh-card p-5 flex items-center justify-between gap-4">
          <div>
            <div className="lh-eyebrow">Subscriptions at year end</div>
            <div className="text-base font-semibold mt-1 text-lh-fore">
              {y.active_subscriptions_at_year_end} active{' '}
              {y.active_subscriptions_at_year_end === 1 ? 'subscription' : 'subscriptions'}
            </div>
          </div>
          <div className="text-right">
            <div className="lh-eyebrow">Monthly run rate</div>
            <div className="text-base font-semibold mt-1 lh-num text-lh-fore">
              {fmtMoney(y.monthly_subscription_cost_cents)}
            </div>
          </div>
        </div>
      </div>

      {/* Print-only block: cleaner layout for PDF export */}
      <div className="lh-print-target px-12 py-12">
        <h1 style={{ fontSize: 28, marginBottom: 4 }}>{year} in review</h1>
        <div style={{ color: '#666', marginBottom: 24 }}>
          {y.receipt_count.toLocaleString()} receipts · {fmtMoney(y.total_cents)} total
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <tbody>
            {y.top_merchants.map((m, i) => (
              <tr key={m.merchant_id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '6px 0', width: 24 }}>{i + 1}</td>
                <td style={{ padding: '6px 0' }}>{m.display_name}</td>
                <td style={{ padding: '6px 0', textAlign: 'right' }}>{fmtMoney(m.total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ color: '#999', fontSize: 11 }}>
          Generated by Lighthouse · {new Date().toISOString().slice(0, 10)}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="lh-card p-4">
      <div className="lh-eyebrow text-[10px]">{label}</div>
      <div className="text-xl font-semibold lh-num mt-1 text-lh-fore">{value}</div>
      {sub ? <div className="text-2xs text-lh-mute mt-0.5 lh-num">{sub}</div> : null}
    </div>
  );
}
