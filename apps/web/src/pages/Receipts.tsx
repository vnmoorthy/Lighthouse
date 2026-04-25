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
import { Search } from 'lucide-react';

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
        title="Receipts"
        description={`Every receipt extracted from your inbox. ${total.toLocaleString()} found.`}
      />
      <div className="px-8 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-lh-mute"
            />
            <input
              className="lh-input pl-8 w-64"
              placeholder="Search merchant or order #"
              value={query}
              onChange={(e) => {
                setOffset(0);
                setQuery(e.target.value);
              }}
            />
          </div>
          <select
            className="lh-input"
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
          <span className="text-xs text-lh-mute ml-auto">
            {total.toLocaleString()} total · showing {offset + 1}–
            {Math.min(offset + limit, total)}
          </span>
        </div>
      </div>

      <div className="p-8">
        <div className="lh-card overflow-hidden">
          <table className="w-full">
            <thead className="text-xs uppercase tracking-wider text-lh-mute bg-lh-paper/50 border-b border-lh-line">
              <tr>
                <th className="text-left px-4 py-3 font-normal">Date</th>
                <th className="text-left px-4 py-3 font-normal">Merchant</th>
                <th className="text-left px-4 py-3 font-normal">Order #</th>
                <th className="text-left px-4 py-3 font-normal">Payment</th>
                <th className="text-right px-4 py-3 font-normal">Amount</th>
                <th className="text-right px-4 py-3 font-normal">Confidence</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {q.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-lh-mute">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-lh-mute">
                    No receipts match the current filter.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-lh-line/40 hover:bg-lh-line/20 cursor-pointer"
                    onClick={() => setOpenId(r.id)}
                  >
                    <td className="px-4 py-3 text-lh-mute whitespace-nowrap">
                      {fmtDate(r.transaction_date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MerchantBadge name={r.merchant_display_name} size="sm" />
                        <span>{r.merchant_display_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-lh-mute font-mono text-xs">
                      {r.order_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-lh-mute text-xs">
                      {r.payment_method ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {fmtMoney(r.total_amount_cents, r.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`lh-pill ${
                          r.confidence >= 0.8
                            ? 'text-emerald-300 bg-emerald-500/10'
                            : r.confidence >= 0.5
                            ? 'text-amber-300 bg-amber-500/10'
                            : 'text-rose-300 bg-rose-500/10'
                        }`}
                      >
                        {(r.confidence * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center mt-4 text-sm">
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

function ReceiptModal({ id, onClose }: { id: number | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['receipt', id],
    queryFn: () => api<ReceiptDetail>(`/api/receipts/${id}`),
    enabled: id != null,
  });

  return (
    <Modal open={id != null} onClose={onClose} title="Receipt detail" width="max-w-3xl">
      {q.isLoading ? (
        <div className="text-sm text-lh-mute">Loading…</div>
      ) : !q.data ? (
        <div className="text-sm text-lh-mute">Receipt not found.</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <MerchantBadge name={q.data.merchant_display_name} size="lg" />
            <div className="flex-1">
              <div className="text-lg font-semibold">{q.data.merchant_display_name}</div>
              <div className="text-sm text-lh-mute">
                {fmtDate(q.data.transaction_date)} · {q.data.order_number ?? 'no order #'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-lh-mute uppercase tracking-wider">Total</div>
              <div className="text-2xl font-semibold tabular-nums">
                {fmtMoney(q.data.total_amount_cents, q.data.currency)}
              </div>
            </div>
          </div>

          {q.data.line_items && q.data.line_items.length > 0 ? (
            <div className="lh-card divide-y divide-lh-line/40">
              {q.data.line_items.map((li, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span>
                    {li.quantity ? <span className="text-lh-mute">{li.quantity}× </span> : null}
                    {li.description}
                  </span>
                  <span className="tabular-nums">
                    {li.total_cents != null ? fmtMoney(li.total_cents, q.data!.currency) : '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div>
            <div className="text-sm font-medium mb-2">Source email</div>
            <EmailViewer emailId={q.data.email_id} />
          </div>
        </div>
      )}
    </Modal>
  );
}
