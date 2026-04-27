/**
 * Income widget: a tiny ledger plus an Add button.
 *
 * Everything LHS-only. We don't try to extract income from emails yet —
 * paystubs are too varied. This is the manual-entry layer.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiPost } from '../lib/api';
import { fmtDate, fmtMoney } from '../lib/format';
import { Plus, Trash2, Repeat, X } from 'lucide-react';

interface IncomeRow {
  id: number;
  source: string;
  amount_cents: number;
  currency: string;
  received_at: number;
  recurring: number;
  cycle: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually' | null;
  note: string | null;
  created_at: number;
}
interface IncomeSummary {
  trailing_30d_cents: number;
  trailing_90d_cents: number;
  trailing_365d_cents: number;
  monthly_recurring_cents: number;
}

export default function IncomeCard() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const q = useQuery({
    queryKey: ['income'],
    queryFn: () => api<{ items: IncomeRow[]; summary: IncomeSummary }>('/api/income'),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/income/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['income'] }),
  });
  const items = q.data?.items ?? [];
  const summary = q.data?.summary;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Mini label="Last 30 days" value={summary ? fmtMoney(summary.trailing_30d_cents) : '—'} />
        <Mini label="Last 365 days" value={summary ? fmtMoney(summary.trailing_365d_cents) : '—'} />
        <Mini
          label="Monthly recurring"
          value={summary ? fmtMoney(summary.monthly_recurring_cents) : '—'}
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="text-2xs text-lh-mute">
          {items.length === 0 ? 'No income recorded yet.' : `${items.length} entries.`}
        </div>
        {!adding ? (
          <button type="button" className="lh-btn !py-1 !px-2 text-2xs" onClick={() => setAdding(true)}>
            <Plus size={12} /> Add income
          </button>
        ) : null}
      </div>
      {adding ? (
        <AddIncome
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            void qc.invalidateQueries({ queryKey: ['income'] });
            void qc.invalidateQueries({ queryKey: ['summary'] });
          }}
        />
      ) : null}
      {items.length > 0 ? (
        <div className="lh-card divide-y divide-lh-line/40">
          {items.slice(0, 6).map((i) => (
            <div key={i.id} className="px-4 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm text-lh-fore">
                  <span className="truncate">{i.source}</span>
                  {i.recurring ? (
                    <span className="lh-pill text-2xs">
                      <Repeat size={10} className="-mr-0.5" /> {i.cycle}
                    </span>
                  ) : null}
                </div>
                <div className="text-2xs text-lh-mute">
                  {fmtDate(i.received_at)}
                  {i.note ? ` · ${i.note}` : ''}
                </div>
              </div>
              <div className="lh-num text-sm text-lh-fore">{fmtMoney(i.amount_cents, i.currency)}</div>
              <button type="button" className="lh-btn-icon" onClick={() => remove.mutate(i.id)} aria-label="Delete">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="lh-card p-3">
      <div className="lh-eyebrow text-[10px]">{label}</div>
      <div className="text-base font-semibold lh-num mt-1 text-lh-fore">{value}</div>
    </div>
  );
}

function AddIncome({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [source, setSource] = useState('');
  const [amountDollars, setAmountDollars] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [cycle, setCycle] = useState<IncomeRow['cycle']>('monthly');
  const create = useMutation({
    mutationFn: () =>
      apiPost('/api/income', {
        source,
        amount_cents: Math.round(Number.parseFloat(amountDollars) * 100),
        recurring,
        cycle: recurring ? cycle : null,
      }),
    onSuccess: onAdded,
  });
  return (
    <div className="lh-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-lh-fore">New income</div>
        <button type="button" className="lh-btn-icon" onClick={onClose}><X size={13} /></button>
      </div>
      <input
        className="lh-input w-full"
        placeholder="Source (e.g. 'Acme Inc — paycheck')"
        value={source}
        onChange={(e) => setSource(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="lh-eyebrow text-[10px]">Amount ($)</span>
          <input
            type="number"
            min="1"
            className="lh-input w-full mt-1"
            value={amountDollars}
            onChange={(e) => setAmountDollars(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 mt-5 text-sm text-lh-fore">
          <input
            type="checkbox"
            className="accent-lh-coral"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
          />
          Recurring
        </label>
      </div>
      {recurring ? (
        <select
          className="lh-select w-full"
          value={cycle ?? 'monthly'}
          onChange={(e) => setCycle(e.target.value as IncomeRow['cycle'])}
        >
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annually">Annually</option>
        </select>
      ) : null}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="lh-btn" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="lh-btn-primary"
          onClick={() => create.mutate()}
          disabled={!source || !amountDollars || create.isPending}
        >
          Save
        </button>
      </div>
    </div>
  );
}
