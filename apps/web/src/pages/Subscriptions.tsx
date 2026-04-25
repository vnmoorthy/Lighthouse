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
import { fmtDate, fmtMoney } from '../lib/format';
import { CheckCheck, X, ChevronRight } from 'lucide-react';

const STATUS_TABS: { key: 'all' | 'active' | 'trial' | 'cancelled'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'trial', label: 'Trial' },
  { key: 'cancelled', label: 'Cancelled' },
];

function statusPillClass(s: string): string {
  return `lh-pill lh-pill-status-${s}`;
}

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
        eyebrow="Recurring"
        title="Subscriptions"
        description={
          subs.length > 0
            ? `${subs.length} recurring charge${subs.length === 1 ? '' : 's'} identified — ${fmtMoney(totalMonthly)} per month at the current cycle.`
            : `Recurring charges Lighthouse identified from your inbox.`
        }
        actions={
          <div className="flex gap-1 bg-lh-paper rounded-md p-1 border border-lh-line">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setSearch({ status: t.key })}
                className={`px-3 py-1.5 text-2xs font-medium rounded-sm transition-all ${
                  status === t.key
                    ? 'bg-lh-line2 text-lh-fore shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]'
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
            <thead className="lh-eyebrow border-b border-lh-line/60">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Merchant</th>
                <th className="text-left px-4 py-3 font-medium">Plan</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Cycle</th>
                <th className="text-right px-4 py-3 font-medium">Per month</th>
                <th className="text-left px-4 py-3 font-medium">Next renewal</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {q.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-lh-line/30">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="lh-skeleton h-3 w-full max-w-[120px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : subs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="text-sm font-medium text-lh-fore">No subscriptions in this view</div>
                    <div className="text-xs text-lh-mute mt-1">
                      Switch to a different status tab, or run a sync to discover more.
                    </div>
                  </td>
                </tr>
              ) : (
                subs.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-lh-line/30 hover:bg-lh-slab2/40 cursor-pointer transition-colors group"
                    onClick={() => setOpenId(s.id)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <MerchantBadge name={s.merchant_display_name} size="sm" />
                        <span className="font-medium text-lh-fore">{s.merchant_display_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-lh-mute">{s.plan_name ?? '—'}</td>
                    <td className="px-4 py-3.5 text-right lh-num text-lh-fore">
                      {fmtMoney(s.amount_cents, s.currency)}
                    </td>
                    <td className="px-4 py-3.5 text-lh-mute capitalize text-xs">{s.billing_cycle}</td>
                    <td className="px-4 py-3.5 text-right lh-num font-medium text-lh-fore">
                      {fmtMoney(s.monthly_cost_cents, s.currency)}
                    </td>
                    <td className="px-4 py-3.5 text-lh-mute lh-num text-xs">
                      {s.next_renewal_date ? fmtDate(s.next_renewal_date) : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={statusPillClass(s.status)}>{s.status}</span>
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
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-2xl h-full bg-lh-paper border-l border-lh-line/60 overflow-y-auto animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-lh-line/60 flex items-center justify-between sticky top-0 bg-lh-paper/95 backdrop-blur-md z-10">
          <div className="lh-eyebrow">Subscription detail</div>
          <button type="button" className="lh-btn-icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-6">
          {q.isLoading ? (
            <>
              <div className="lh-skeleton h-12 w-full" />
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="lh-skeleton h-16" />
                ))}
              </div>
              <div className="lh-skeleton h-40 w-full" />
            </>
          ) : !q.data ? (
            <div className="text-sm text-lh-mute">Subscription not found.</div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <MerchantBadge name={q.data.merchant_display_name} size="lg" ring />
                <div className="flex-1 min-w-0">
                  <div className="text-xl font-semibold tracking-snug text-lh-fore truncate">
                    {q.data.merchant_display_name}
                  </div>
                  <div className="text-sm text-lh-mute truncate">{q.data.plan_name ?? 'No plan name'}</div>
                </div>
                <span className={statusPillClass(q.data.status)}>{q.data.status}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat
                  label="Amount"
                  value={`${fmtMoney(q.data.amount_cents, q.data.currency)} / ${q.data.billing_cycle}`}
                />
                <Stat label="Per month" value={fmtMoney(q.data.monthly_cost_cents, q.data.currency)} />
                <Stat
                  label="Next renewal"
                  value={q.data.next_renewal_date ? fmtDate(q.data.next_renewal_date) : '—'}
                />
                <Stat
                  label="Trial ends"
                  value={q.data.trial_end_date ? fmtDate(q.data.trial_end_date) : '—'}
                />
              </div>

              <div>
                <div className="lh-eyebrow mb-2">Charge history</div>
                <div className="lh-card divide-y divide-lh-line/40 overflow-hidden">
                  {q.data.charges.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-lh-mute">
                      No charges yet — identified from a signup or trial email.
                    </div>
                  ) : (
                    q.data.charges.map((c) => (
                      <div
                        key={c.id}
                        className="px-4 py-2.5 flex items-center justify-between text-sm hover:bg-lh-slab2/30"
                      >
                        <span className="text-lh-mute lh-num">{fmtDate(c.charge_date)}</span>
                        <span className="lh-num font-medium text-lh-fore">
                          {fmtMoney(c.amount_cents, c.currency)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="lh-eyebrow mb-2">Source email</div>
                <EmailViewer emailId={q.data.last_seen_email_id} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="lh-card p-3.5">
      <div className="lh-eyebrow text-[10px]">{label}</div>
      <div className="text-sm font-semibold mt-1 text-lh-fore lh-num">{value}</div>
    </div>
  );
}
