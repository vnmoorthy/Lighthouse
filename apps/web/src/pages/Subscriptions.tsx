import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  api,
  apiPost,
  type SubscriptionDetail,
  type SubscriptionListItem,
} from '../lib/api';
import PageHeader from '../components/PageHeader';
import MerchantBadge from '../components/MerchantBadge';
import EmailViewer from '../components/EmailViewer';
import { fmtDate, fmtMoney, classifyStatusColor } from '../lib/format';
import { CheckCheck, X } from 'lucide-react';

const STATUS_TABS: { key: 'all' | 'active' | 'trial' | 'cancelled'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'trial', label: 'Trial' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function SubscriptionsPage() {
  const [search, setSearch] = useSearchParams();
  const status = (search.get('status') ?? 'active') as 'all' | 'active' | 'trial' | 'cancelled';
  const [openId, setOpenId] = useState<number | null>(null);

  const q = useQuery({
    queryKey: ['subscriptions', status],
    queryFn: () =>
      api<{ subscriptions: SubscriptionListItem[] }>(
        `/api/subscriptions${status !== 'all' ? `?status=${status}` : ''}`,
      ),
  });

  const subs = q.data?.subscriptions ?? [];
  const totalMonthly = subs
    .filter((s) => s.status === 'active' || s.status === 'trial')
    .reduce((a, s) => a + s.monthly_cost_cents, 0);

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description={`Recurring charges Lighthouse identified from your inbox. ${
          subs.length > 0 ? fmtMoney(totalMonthly) + ' / month at current cycle.' : ''
        }`}
        actions={
          <div className="flex gap-1 bg-lh-paper rounded-lg p-1 border border-lh-line">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setSearch({ status: t.key })}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  status === t.key
                    ? 'bg-lh-line2 text-lh-fore'
                    : 'text-lh-mute hover:text-lh-fore'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />
      <div className="p-8">
        <div className="lh-card overflow-hidden">
          <table className="w-full">
            <thead className="text-xs uppercase tracking-wider text-lh-mute bg-lh-paper/50 border-b border-lh-line">
              <tr>
                <th className="text-left px-4 py-3 font-normal">Merchant</th>
                <th className="text-left px-4 py-3 font-normal">Plan</th>
                <th className="text-right px-4 py-3 font-normal">Amount</th>
                <th className="text-left px-4 py-3 font-normal">Cycle</th>
                <th className="text-right px-4 py-3 font-normal">Per month</th>
                <th className="text-left px-4 py-3 font-normal">Next renewal</th>
                <th className="text-left px-4 py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {q.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-lh-mute">
                    Loading…
                  </td>
                </tr>
              ) : subs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-lh-mute">
                    No subscriptions in this view yet.
                  </td>
                </tr>
              ) : (
                subs.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-lh-line/40 hover:bg-lh-line/20 cursor-pointer"
                    onClick={() => setOpenId(s.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <MerchantBadge name={s.merchant_display_name} size="sm" />
                        <span className="font-medium">{s.merchant_display_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-lh-mute">{s.plan_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtMoney(s.amount_cents, s.currency)}
                    </td>
                    <td className="px-4 py-3 text-lh-mute capitalize">{s.billing_cycle}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtMoney(s.monthly_cost_cents, s.currency)}
                    </td>
                    <td className="px-4 py-3 text-lh-mute">
                      {s.next_renewal_date ? fmtDate(s.next_renewal_date) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${classifyStatusColor(
                          s.status,
                        )}`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SubscriptionDrawer id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function SubscriptionDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['subscription', id],
    queryFn: () => api<SubscriptionDetail>(`/api/subscriptions/${id}`),
    enabled: id != null,
  });
  const cancel = useMutation({
    mutationFn: () => apiPost(`/api/subscriptions/${id}/mark-cancelled`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscriptions'] });
      void qc.invalidateQueries({ queryKey: ['subscription', id] });
      void qc.invalidateQueries({ queryKey: ['summary'] });
    },
  });

  if (id == null) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-2xl h-full bg-lh-paper border-l border-lh-line overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-lh-line/60 flex items-center justify-between sticky top-0 bg-lh-paper/95 backdrop-blur z-10">
          <div className="text-sm text-lh-mute">Subscription detail</div>
          <button
            type="button"
            className="text-lh-mute hover:text-lh-fore"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-6">
          {q.isLoading ? (
            <div className="text-sm text-lh-mute">Loading…</div>
          ) : !q.data ? (
            <div className="text-sm text-lh-mute">Subscription not found.</div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <MerchantBadge name={q.data.merchant_display_name} size="lg" />
                <div className="flex-1">
                  <div className="text-xl font-semibold">{q.data.merchant_display_name}</div>
                  <div className="text-sm text-lh-mute">{q.data.plan_name ?? 'No plan name'}</div>
                </div>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${classifyStatusColor(
                    q.data.status,
                  )}`}
                >
                  {q.data.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="lh-card p-3">
                  <div className="text-xs text-lh-mute">Amount</div>
                  <div className="font-semibold">
                    {fmtMoney(q.data.amount_cents, q.data.currency)} /{' '}
                    {q.data.billing_cycle}
                  </div>
                </div>
                <div className="lh-card p-3">
                  <div className="text-xs text-lh-mute">Per month</div>
                  <div className="font-semibold">
                    {fmtMoney(q.data.monthly_cost_cents, q.data.currency)}
                  </div>
                </div>
                <div className="lh-card p-3">
                  <div className="text-xs text-lh-mute">Next renewal</div>
                  <div className="font-semibold">
                    {q.data.next_renewal_date ? fmtDate(q.data.next_renewal_date) : '—'}
                  </div>
                </div>
                <div className="lh-card p-3">
                  <div className="text-xs text-lh-mute">Trial ends</div>
                  <div className="font-semibold">
                    {q.data.trial_end_date ? fmtDate(q.data.trial_end_date) : '—'}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Charge history</div>
                <div className="lh-card divide-y divide-lh-line/40">
                  {q.data.charges.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-lh-mute">
                      No charges yet — this subscription was identified from a signup or trial email.
                    </div>
                  ) : (
                    q.data.charges.map((c) => (
                      <div key={c.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                        <span className="text-lh-mute">{fmtDate(c.charge_date)}</span>
                        <span className="tabular-nums">
                          {fmtMoney(c.amount_cents, c.currency)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Source email</div>
                <EmailViewer emailId={q.data.last_seen_email_id} />
              </div>

              <div className="flex justify-end gap-2">
                {q.data.status !== 'cancelled' ? (
                  <button
                    type="button"
                    className="lh-btn"
                    onClick={() => cancel.mutate()}
                    disabled={cancel.isPending}
                  >
                    <CheckCheck size={14} />
                    Mark cancelled
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
