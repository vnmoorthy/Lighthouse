/**
 * Per-merchant timeline page.
 *
 * Shows: hero KPIs, monthly spend bars, full receipt list (link-back to
 * the receipts modal). Calendar heatmap could be a future addition;
 * this is the prose version.
 */
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import MerchantBadge from '../components/MerchantBadge';
import { fmtDate, fmtMoney, fmtMonth } from '../lib/format';

interface TimelineResponse {
  merchant: {
    id: number;
    display_name: string;
    canonical_name: string;
    domain: string | null;
    category: string | null;
  };
  total_cents: number;
  count: number;
  first_seen: number | null;
  last_seen: number | null;
  monthly: { month: string; total_cents: number; count: number }[];
  receipts: {
    receipt_id: number;
    email_id: number;
    date: number;
    amount_cents: number;
    currency: string;
    order_number: string | null;
  }[];
}

export default function MerchantPage() {
  const params = useParams();
  const id = Number.parseInt(params.id ?? '0', 10);
  const q = useQuery({
    queryKey: ['merchant-timeline', id],
    queryFn: () => api<TimelineResponse>(`/api/merchants/${id}/timeline`),
    enabled: id > 0,
  });

  if (q.isLoading) {
    return (
      <div>
        <PageHeader title="Merchant" />
        <div className="p-8 lh-skeleton h-40 w-full" />
      </div>
    );
  }
  if (!q.data) {
    return (
      <div>
        <PageHeader title="Merchant" />
        <div className="p-8 text-sm text-rose-300">Merchant not found.</div>
      </div>
    );
  }
  const t = q.data;
  const max = Math.max(1, ...t.monthly.map((m) => m.total_cents));
  const monthsOnRecord =
    t.first_seen && t.last_seen
      ? Math.max(1, Math.round((t.last_seen - t.first_seen) / (30 * 24 * 60 * 60 * 1000)))
      : 0;
  const avgMonthly = monthsOnRecord > 0 ? Math.round(t.total_cents / monthsOnRecord) : 0;

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link to="/receipts" className="hover:text-lh-fore inline-flex items-center gap-1">
            <ArrowLeft size={11} /> Back to receipts
          </Link>
        }
        title={t.merchant.display_name}
        description={
          t.count > 0
            ? `${t.count} receipt${t.count === 1 ? '' : 's'} totaling ${fmtMoney(t.total_cents)} since ${fmtDate(t.first_seen ?? Date.now())}.`
            : 'No receipts on file yet.'
        }
      />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Total spent" value={fmtMoney(t.total_cents)} />
          <Stat label="Receipts" value={String(t.count)} />
          <Stat label="Avg / month" value={fmtMoney(avgMonthly)} />
          <Stat
            label="Most recent"
            value={t.last_seen ? fmtDate(t.last_seen) : '—'}
          />
        </div>

        <div className="lh-card p-5">
          <div className="flex items-end justify-between mb-4">
            <div className="flex items-center gap-3">
              <MerchantBadge name={t.merchant.display_name} size="lg" ring />
              <div>
                <div className="lh-eyebrow">Spend over time</div>
                <div className="text-base font-semibold mt-1 text-lh-fore">
                  Monthly totals at {t.merchant.display_name}
                </div>
              </div>
            </div>
            {t.merchant.category ? (
              <span className="lh-pill">{t.merchant.category}</span>
            ) : null}
          </div>
          <div className="flex items-end gap-1 h-40">
            {t.monthly.map((m) => {
              const h = (m.total_cents / max) * 100;
              return (
                <div
                  key={m.month}
                  className="flex-1 flex flex-col items-center gap-1 group min-w-0"
                  title={`${fmtMonth(m.month)} — ${fmtMoney(m.total_cents)} (${m.count} receipts)`}
                >
                  <div
                    className="w-full rounded-t-sm bg-gradient-to-t from-lh-coral to-lh-gold transition-all duration-300 group-hover:from-lh-coralDeep"
                    style={{ height: `${Math.max(2, h)}%` }}
                  />
                  <div className="text-[9px] text-lh-mute lh-num">
                    {m.month.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="lh-eyebrow mb-3 px-1">Receipts</div>
          <div className="lh-card overflow-hidden">
            <table className="w-full">
              <thead className="lh-eyebrow border-b border-lh-line/60">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Order #</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {t.receipts.map((r) => (
                  <tr
                    key={r.receipt_id}
                    className="border-b border-lh-line/30 hover:bg-lh-slab2/40"
                  >
                    <td className="px-5 py-3 text-lh-mute lh-num text-xs whitespace-nowrap">
                      {fmtDate(r.date)}
                    </td>
                    <td className="px-4 py-3 text-lh-mute font-mono text-xs">
                      {r.order_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right lh-num font-medium text-lh-fore">
                      {fmtMoney(r.amount_cents, r.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="lh-card p-4">
      <div className="lh-eyebrow text-[10px]">{label}</div>
      <div className="text-xl font-semibold lh-num mt-1 text-lh-fore">{value}</div>
    </div>
  );
}
