import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  api,
  type MerchantItem,
  type ReceiptDetail,
  type ReceiptListItem,
} from '../lib/api';
import PageHeader from '../components/PageHeader';
import MerchantBadge from '../components/MerchantBadge';
import EmailViewer from '../components/EmailViewer';
import Modal from '../components/Modal';
import { fmtDate, fmtMoney } from '../lib/format';
import { Search, ChevronRight } from 'lucide-react';

export default function ReceiptsPage() {
  const [query, setQuery] = useState('');
  const [merchant, setMerchant] = useState<string>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);

  const merchants = useQuery({
    queryKey: ['merchants'],
    queryFn: () => api<{ merchants: MerchantItem[] }>('/api/merchants'),
  });

  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (merchant) params.set('merchant', merchant);
  if (from) params.set('from', String(new Date(from).getTime()));
  if (to) params.set('to', String(new Date(to).getTime()));
  params.set('limit', String(limit));
  params.set('offset', String(offset));

  const q = useQuery({
    queryKey: ['receipts', params.toString()],
    queryFn: () => api<{ total: number; receipts: ReceiptListItem[] }>(`/api/receipts?${params}`),
  });
  const total = q.data?.total ?? 0;
  const rows = q.data?.receipts ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Ledger"
        title="Receipts"
        description={
          total > 0
            ? `Every receipt extracted from your inbox. ${total.toLocaleString()} found.`
            : 'Every receipt extracted from your inbox will live here.'
        }
      />
      <div className="px-8 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-lh-mute" />
            <input
              className="lh-input pl-8 w-72"
              placeholder="Search merchant or order #"
              value={query}
              onChange={(e) => {
                setOffset(0);
                setQuery(e.target.value);
              }}
            />
          </div>
          <select
            className="lh-select"
            value={merchant}
            onChange={(e) => {
              setOffset(0);
              setMerchant(e.target.value);
            }}
          >
            <option value="">All merchants</option>
            {(merchants.data?.merchants ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="lh-input"
            value={from}
            onChange={(e) => {
              setOffset(0);
              setFrom(e.target.value);
            }}
          />
          <span className="text-lh-mute text-xs">to</span>
          <input
            type="date"
            className="lh-input"
            value={to}
            onChange={(e) => {
              setOffset(0);
              setTo(e.target.value);
            }}
          />
          <span className="text-2xs text-lh-mute ml-auto lh-num">
            {total.toLocaleString()} total · {offset + 1}–{Math.min(offset + limit, total)}
          </span>
        </div>
      </div>

      <div className="p-8">
        <div className="lh-card overflow-hidden">
          <table className="w-full">
            <thead className="lh-eyebrow border-b border-lh-line/60">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Merchant</th>
                <th className="text-left px-4 py-3 font-medium">Order #</th>
                <th className="text-left px-4 py-3 font-medium">Payment</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-right px-4 py-3 font-medium">Confidence</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {q.isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-lh-line/30">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="lh-skeleton h-3 w-full max-w-[120px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="text-sm font-medium text-lh-fore">No receipts match the filter</div>
                    <div className="text-xs text-lh-mute mt-1">
                      Try clearing search or expanding the date range.
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-lh-line/30 hover:bg-lh-slab2/40 cursor-pointer transition-colors group"
                    onClick={() => setOpenId(r.id)}
                  >
                    <td className="px-5 py-3.5 text-lh-mute lh-num text-xs whitespace-nowrap">
                      {fmtDate(r.transaction_date)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <MerchantBadge name={r.merchant_display_name} size="sm" />
                        <span className="text-lh-fore">{r.merchant_display_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-lh-mute font-mono text-xs">
                      {r.order_number ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-lh-mute text-xs">{r.payment_method ?? '—'}</td>
                    <td className="px-4 py-3.5 text-right lh-num font-medium text-lh-fore">
                      {fmtMoney(r.total_amount_cents, r.currency)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <ConfidencePill v={r.confidence} />
                    </td>
                    <td className="pr-3">
                      <ChevronRight size={14} className="text-lh-mute opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center mt-4 text-xs">
          <span className="text-lh-mute">
            Page {Math.floor(offset / limit) + 1} of {Math.max(1, Math.ceil(total / limit))}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="lh-btn"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </button>
            <button
              type="button"
              className="lh-btn"
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <ReceiptModal id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function ConfidencePill({ v }: { v: number }) {
  const cls =
    v >= 0.85
      ? 'text-emerald-300 bg-emerald-500/10'
      : v >= 0.65
      ? 'text-amber-300 bg-amber-500/10'
      : 'text-rose-300 bg-rose-500/10';
  return (
    <span
      className={`inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded tabular-nums ${cls}`}
    >
      <span className="w-1 h-1 rounded-full bg-current opacity-70" />
      {(v * 100).toFixed(0)}%
    </span>
  );
}

function ReceiptModal({ id, onClose }: { id: number | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['receipt', id],
    queryFn: () => api<ReceiptDetail>(`/api/receipts/${id}`),
    enabled: id != null,
  });

  return (
    <Modal
      open={id != null}
      onClose={onClose}
      title="Receipt"
      description="The structured fields the LLM extracted from the original email."
      width="max-w-3xl"
    >
      {q.isLoading ? (
        <div className="space-y-3">
          <div className="lh-skeleton h-12 w-full" />
          <div className="lh-skeleton h-32 w-full" />
        </div>
      ) : !q.data ? (
        <div className="text-sm text-lh-mute">Receipt not found.</div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <MerchantBadge name={q.data.merchant_display_name} size="lg" ring />
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold tracking-snug text-lh-fore truncate">
                {q.data.merchant_display_name}
              </div>
              <div className="text-xs text-lh-mute lh-num">
                {fmtDate(q.data.transaction_date)} · {q.data.order_number ?? 'no order #'}
              </div>
            </div>
            <div className="text-right">
              <div className="lh-eyebrow">Total</div>
              <div className="text-2xl font-semibold lh-num text-lh-fore">
                {fmtMoney(q.data.total_amount_cents, q.data.currency)}
              </div>
            </div>
          </div>

          {q.data.line_items && q.data.line_items.length > 0 ? (
            <div>
              <div className="lh-eyebrow mb-2">Line items</div>
              <div className="lh-card divide-y divide-lh-line/40 overflow-hidden">
                {q.data.line_items.map((li, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <span className="text-lh-fore">
                      {li.quantity ? <span className="text-lh-mute mr-1.5 lh-num">{li.quantity}×</span> : null}
                      {li.description}
                    </span>
                    <span className="lh-num text-lh-mute">
                      {li.total_cents != null ? fmtMoney(li.total_cents, q.data!.currency) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <div className="lh-eyebrow mb-2">Source email</div>
            <EmailViewer emailId={q.data.email_id} />
          </div>
        </div>
      )}
    </Modal>
  );
}
