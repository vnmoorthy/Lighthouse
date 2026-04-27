import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
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
import { CATEGORY_LABEL } from '../components/CategoryBreakdown';
import { fmtDate, fmtMoney } from '../lib/format';
import { Search, ChevronRight, X, Printer, Check } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '../lib/api';

export default function ReceiptsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [merchant, setMerchant] = useState<string>('');
  const category = searchParams.get('category') ?? '';
  const setCategory = (c: string) => {
    const next = new URLSearchParams(searchParams);
    if (c) next.set('category', c);
    else next.delete('category');
    setSearchParams(next);
    setOffset(0);
  };
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const qc = useQueryClient();

  const merchants = useQuery({
    queryKey: ['merchants'],
    queryFn: () => api<{ merchants: MerchantItem[] }>('/api/merchants'),
  });

  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (merchant) params.set('merchant', merchant);
  if (category) params.set('category', category);
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
          <select
            className="lh-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          {category ? (
            <button
              type="button"
              onClick={() => setCategory('')}
              className="lh-btn-ghost text-2xs"
              title="Clear category filter"
            >
              <X size={12} /> {CATEGORY_LABEL[category] ?? category}
            </button>
          ) : null}
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
        {selected.size > 0 ? (
          <BulkBar
            selected={selected}
            merchants={merchants.data?.merchants ?? []}
            onClear={() => setSelected(new Set())}
            onApplied={() => {
              setSelected(new Set());
              void qc.invalidateQueries({ queryKey: ['receipts'] });
              void qc.invalidateQueries({ queryKey: ['summary'] });
            }}
          />
        ) : null}
      </div>

      <div className="p-8">
        <div className="lh-card overflow-hidden">
          <table className="w-full">
            <thead className="lh-eyebrow border-b border-lh-line/60">
              <tr>
                <th className="w-10 pl-5">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    className="accent-lh-coral"
                    checked={selected.size > 0 && rows.every((r) => selected.has(r.id))}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) rows.forEach((r) => next.add(r.id));
                      else rows.forEach((r) => next.delete(r.id));
                      setSelected(next);
                    }}
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
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
                    className={`border-b border-lh-line/30 cursor-pointer transition-colors group ${selected.has(r.id) ? 'bg-lh-coral/5' : 'hover:bg-lh-slab2/40'}`}
                    onClick={() => setOpenId(r.id)}
                  >
                    <td className="pl-5 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label="Select"
                        className="accent-lh-coral"
                        checked={selected.has(r.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(r.id);
                          else next.delete(r.id);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td className="px-4 py-3.5 text-lh-mute lh-num text-xs whitespace-nowrap">
                      {fmtDate(r.transaction_date)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <MerchantBadge name={r.merchant_display_name} size="sm" />
                        <Link
                          to={`/merchants/${r.merchant_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-lh-fore hover:text-lh-coral transition-colors"
                        >
                          {r.merchant_display_name}
                        </Link>
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

function BulkBar({
  selected,
  merchants,
  onClear,
  onApplied,
}: {
  selected: Set<number>;
  merchants: MerchantItem[];
  onClear: () => void;
  onApplied: () => void;
}) {
  const [target, setTarget] = useState('');
  const apply = useMutation({
    mutationFn: () =>
      apiPost('/api/receipts/bulk-merchant', {
        receipt_ids: [...selected],
        merchant_id: Number.parseInt(target, 10),
      }),
    onSuccess: onApplied,
  });
  return (
    <div className="mt-3 flex items-center gap-2 lh-card !rounded-md p-2 px-3">
      <Check size={13} className="text-lh-coral" />
      <span className="text-2xs text-lh-fore">
        <span className="font-medium">{selected.size}</span> selected
      </span>
      <span className="text-lh-mute text-2xs">·</span>
      <span className="text-2xs text-lh-mute">Reassign to:</span>
      <select
        className="lh-select !py-1 !text-xs"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      >
        <option value="">Pick a merchant…</option>
        {merchants.map((m) => (
          <option key={m.id} value={m.id}>
            {m.display_name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="lh-btn-primary !py-1 !px-2 text-2xs"
        disabled={!target || apply.isPending}
        onClick={() => apply.mutate()}
      >
        Apply
      </button>
      <button type="button" className="lh-btn-ghost ml-auto text-2xs" onClick={onClear}>
        Clear
      </button>
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

  function printReceipt() {
    document.body.classList.add('lh-printing');
    const off = () => {
      document.body.classList.remove('lh-printing');
      window.removeEventListener('afterprint', off);
    };
    window.addEventListener('afterprint', off);
    setTimeout(() => window.print(), 80);
  }

  return (
    <Modal
      open={id != null}
      onClose={onClose}
      title="Receipt"
      description="The structured fields the LLM extracted from the original email."
      width="max-w-3xl"
      footer={
        q.data ? (
          <button type="button" className="lh-btn" onClick={printReceipt}>
            <Printer size={14} />
            Print / Save as PDF
          </button>
        ) : undefined
      }
    >
      {q.isLoading ? (
        <div className="space-y-3">
          <div className="lh-skeleton h-12 w-full" />
          <div className="lh-skeleton h-32 w-full" />
        </div>
      ) : !q.data ? (
        <div className="text-sm text-lh-mute">Receipt not found.</div>
      ) : (
        <>
          {/* Hidden until printed — clean printable version */}
          <div className="lh-print-target">
            <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, lineHeight: 1.4 }}>
              <h1 style={{ fontSize: 22, marginBottom: 4 }}>{q.data.merchant_display_name}</h1>
              <div style={{ color: '#666', marginBottom: 24 }}>
                {fmtDate(q.data.transaction_date)} · {q.data.order_number ?? '—'}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {(q.data.line_items ?? []).map((li, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px 0' }}>
                        {li.quantity ? `${li.quantity}× ` : ''}{li.description}
                      </td>
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>
                        {li.total_cents != null ? fmtMoney(li.total_cents, q.data!.currency) : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid #1c1c19', fontWeight: 600 }}>
                    <td style={{ padding: '12px 0' }}>Total</td>
                    <td style={{ padding: '12px 0', textAlign: 'right' }}>
                      {fmtMoney(q.data.total_amount_cents, q.data.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: 24, color: '#666', fontSize: 12 }}>
                Payment: {q.data.payment_method ?? '—'}
              </div>
              <div style={{ marginTop: 36, color: '#999', fontSize: 11 }}>
                Generated by Lighthouse from your inbox · localhost-only · {new Date().toISOString().slice(0, 10)}
              </div>
            </div>
          </div>

        <div className="space-y-5 lh-no-print">
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
        </>
      )}
    </Modal>
  );
}
