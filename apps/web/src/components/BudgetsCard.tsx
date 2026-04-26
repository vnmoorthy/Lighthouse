/**
 * Budgets card. Two views:
 *   - Display (used everywhere): shows progress per budget.
 *   - Edit (used in Settings): create/update/delete budgets.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiPost } from '../lib/api';
import { CATEGORY_LABEL, categoryColor } from './CategoryBreakdown';
import { fmtMoney } from '../lib/format';
import { Plus, Trash2, X } from 'lucide-react';

interface BudgetProgress {
  id: number;
  category: string;
  amount_cents: number;
  created_at: number;
  updated_at: number;
  used_cents: number;
  remaining_cents: number;
  pct_used: number;
  pct_of_month: number;
  pace_ratio: number;
}

export function BudgetsDisplay({ compact = false }: { compact?: boolean }) {
  const q = useQuery({
    queryKey: ['budgets'],
    queryFn: () => api<{ budgets: BudgetProgress[] }>('/api/budgets'),
  });
  if (q.isLoading) return null;
  const list = q.data?.budgets ?? [];
  if (list.length === 0) return null;

  const visible = compact ? list.slice(0, 4) : list;

  return (
    <div className="lh-card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="lh-eyebrow">Budgets</div>
          <div className="text-base font-semibold mt-1 text-lh-fore">This month</div>
        </div>
        <div className="text-2xs text-lh-mute">
          {Math.round((list[0]?.pct_of_month ?? 0) * 100)}% through the month
        </div>
      </div>
      <div className="space-y-3">
        {visible.map((b) => (
          <BudgetRow key={b.id} b={b} />
        ))}
      </div>
    </div>
  );
}

function BudgetRow({ b }: { b: BudgetProgress }) {
  const pct = Math.min(1, b.pct_used);
  const overpace = b.pace_ratio > 1.05;
  const overcap = b.pct_used > 1;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm mb-1.5">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm" style={{ background: categoryColor(b.category) }} />
          <span className="text-lh-fore">{CATEGORY_LABEL[b.category] ?? b.category}</span>
          {overpace && !overcap ? (
            <span className="lh-pill bg-amber-500/10 text-amber-300 border-amber-500/20 text-2xs">
              ahead of pace
            </span>
          ) : null}
          {overcap ? (
            <span className="lh-pill bg-rose-500/10 text-rose-300 border-rose-500/20 text-2xs">
              over budget
            </span>
          ) : null}
        </span>
        <span className="text-2xs lh-num text-lh-mute">
          <span className={overcap ? 'text-rose-300 font-medium' : 'text-lh-fore'}>
            {fmtMoney(b.used_cents)}
          </span>
          {' / '}
          {fmtMoney(b.amount_cents)}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-lh-line/60 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-spring"
          style={{
            width: `${Math.max(2, pct * 100)}%`,
            background: overcap ? '#e88a91' : categoryColor(b.category),
          }}
        />
        {/* Pace marker line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/20"
          style={{ left: `${Math.min(98, b.pct_of_month * 100)}%` }}
          title={`${Math.round(b.pct_of_month * 100)}% of month elapsed`}
        />
      </div>
    </div>
  );
}

export function BudgetsEdit() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['budgets'],
    queryFn: () => api<{ budgets: BudgetProgress[] }>('/api/budgets'),
  });
  const [creating, setCreating] = useState(false);
  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/budgets/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  });
  const list = q.data?.budgets ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-2xs text-lh-mute">
          {list.length === 0 ? 'No budgets yet.' : `${list.length} active budget${list.length === 1 ? '' : 's'}.`}
        </div>
        {!creating ? (
          <button
            type="button"
            className="lh-btn !py-1 !px-2 text-2xs"
            onClick={() => setCreating(true)}
          >
            <Plus size={12} /> New budget
          </button>
        ) : null}
      </div>
      {creating ? (
        <CreateBudget
          existing={new Set(list.map((b) => b.category))}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void qc.invalidateQueries({ queryKey: ['budgets'] });
          }}
        />
      ) : null}
      {list.length > 0 ? (
        <div className="lh-card divide-y divide-lh-line/40">
          {list.map((b) => (
            <div key={b.id} className="px-4 py-3 flex items-center gap-3">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: categoryColor(b.category) }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-lh-fore">
                  {CATEGORY_LABEL[b.category] ?? b.category}
                </div>
                <div className="text-2xs text-lh-mute mt-0.5 lh-num">
                  {fmtMoney(b.used_cents)} of {fmtMoney(b.amount_cents)} used
                </div>
              </div>
              <button
                type="button"
                className="lh-btn-icon"
                onClick={() => remove.mutate(b.id)}
                aria-label="Delete budget"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CreateBudget({
  existing,
  onClose,
  onCreated,
}: {
  existing: Set<string>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const available = Object.entries(CATEGORY_LABEL).filter(([k]) => !existing.has(k));
  const [category, setCategory] = useState(available[0]?.[0] ?? 'food');
  const [amountDollars, setAmountDollars] = useState('200');
  const create = useMutation({
    mutationFn: () =>
      apiPost('/api/budgets', {
        category,
        amount_cents: Math.round(Number.parseFloat(amountDollars) * 100),
      }),
    onSuccess: () => onCreated(),
  });
  if (available.length === 0) {
    return (
      <div className="lh-card p-4 text-2xs text-lh-mute">
        Every category already has a budget. Edit one above by deleting + recreating.
      </div>
    );
  }
  return (
    <div className="lh-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-lh-fore">New budget</div>
        <button type="button" className="lh-btn-icon" onClick={onClose} aria-label="Close">
          <X size={13} />
        </button>
      </div>
      <select className="lh-select w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
        {available.map(([k, l]) => (
          <option key={k} value={k}>{l}</option>
        ))}
      </select>
      <label className="block">
        <span className="lh-eyebrow text-[10px]">Monthly cap ($)</span>
        <input
          type="number"
          min="1"
          className="lh-input w-full mt-1"
          value={amountDollars}
          onChange={(e) => setAmountDollars(e.target.value)}
        />
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="lh-btn" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="lh-btn-primary"
          onClick={() => create.mutate()}
          disabled={create.isPending}
        >
          Save budget
        </button>
      </div>
    </div>
  );
}
