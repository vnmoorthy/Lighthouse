/**
 * Goals widget. Spending caps with a horizon (week/month/year/custom).
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiPost } from '../lib/api';
import { CATEGORY_LABEL, categoryColor } from './CategoryBreakdown';
import { fmtMoney } from '../lib/format';
import { Plus, Trash2, X, Target } from 'lucide-react';

interface GoalProgress {
  id: number;
  name: string;
  category: string | null;
  cap_cents: number;
  period: 'weekly' | 'monthly' | 'annual' | 'custom';
  used_cents: number;
  remaining_cents: number;
  pct_used: number;
  pct_of_window: number;
}

export function GoalsList() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const q = useQuery({
    queryKey: ['goals'],
    queryFn: () => api<{ goals: GoalProgress[] }>('/api/goals'),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/goals/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
  const list = q.data?.goals ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-2xs text-lh-mute">
          {list.length === 0
            ? 'No goals yet.'
            : `${list.length} active goal${list.length === 1 ? '' : 's'}.`}
        </div>
        {!creating ? (
          <button type="button" className="lh-btn !py-1 !px-2 text-2xs" onClick={() => setCreating(true)}>
            <Plus size={12} /> New goal
          </button>
        ) : null}
      </div>

      {creating ? (
        <CreateGoal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void qc.invalidateQueries({ queryKey: ['goals'] });
          }}
        />
      ) : null}

      {list.length > 0 ? (
        <div className="space-y-2">
          {list.map((g) => (
            <GoalRow key={g.id} g={g} onDelete={() => remove.mutate(g.id)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GoalRow({ g, onDelete }: { g: GoalProgress; onDelete: () => void }) {
  const pct = Math.min(1, g.pct_used);
  const overpace = g.pct_of_window > 0 && g.pct_used / g.pct_of_window > 1.05;
  const overcap = g.pct_used > 1;
  return (
    <div className="lh-card p-3.5">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Target size={13} className="text-lh-coral shrink-0" />
          <span className="text-sm text-lh-fore truncate">{g.name}</span>
          {g.category ? (
            <span
              className="lh-pill text-2xs"
              style={{
                background: categoryColor(g.category) + '22',
                color: categoryColor(g.category),
                borderColor: categoryColor(g.category) + '44',
              }}
            >
              {CATEGORY_LABEL[g.category] ?? g.category}
            </span>
          ) : null}
          <span className="lh-pill text-2xs">{g.period}</span>
          {overcap ? (
            <span className="lh-pill bg-rose-500/10 text-rose-300 border-rose-500/20 text-2xs">over</span>
          ) : overpace ? (
            <span className="lh-pill bg-amber-500/10 text-amber-300 border-amber-500/20 text-2xs">
              ahead of pace
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-2xs lh-num text-lh-mute">
            <span className={overcap ? 'text-rose-300 font-medium' : 'text-lh-fore'}>
              {fmtMoney(g.used_cents)}
            </span>{' '}
            / {fmtMoney(g.cap_cents)}
          </span>
          <button type="button" className="lh-btn-icon" onClick={onDelete} aria-label="Delete">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <div className="relative h-1.5 rounded-full bg-lh-line/60 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-spring"
          style={{
            width: `${Math.max(2, pct * 100)}%`,
            background: overcap ? '#e88a91' : g.category ? categoryColor(g.category) : '#e58e5a',
          }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-white/20"
          style={{ left: `${Math.min(98, g.pct_of_window * 100)}%` }}
          title={`${Math.round(g.pct_of_window * 100)}% through window`}
        />
      </div>
    </div>
  );
}

function CreateGoal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [period, setPeriod] = useState<GoalProgress['period']>('monthly');
  const [category, setCategory] = useState<string>('');
  const [capDollars, setCapDollars] = useState('200');

  const create = useMutation({
    mutationFn: () =>
      apiPost('/api/goals', {
        name,
        category: category || null,
        cap_cents: Math.round(Number.parseFloat(capDollars) * 100),
        period,
      }),
    onSuccess: () => onCreated(),
  });

  return (
    <div className="lh-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-lh-fore">New goal</div>
        <button type="button" className="lh-btn-icon" onClick={onClose} aria-label="Close">
          <X size={13} />
        </button>
      </div>
      <input
        className="lh-input w-full"
        placeholder="Goal name (e.g. 'Eating out')"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          className="lh-select w-full"
          value={period}
          onChange={(e) => setPeriod(e.target.value as GoalProgress['period'])}
        >
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
        </select>
        <select
          className="lh-select w-full"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All spending</option>
          {Object.entries(CATEGORY_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <label className="block">
        <span className="lh-eyebrow text-[10px]">Cap ($)</span>
        <input
          type="number"
          min="1"
          className="lh-input w-full mt-1"
          value={capDollars}
          onChange={(e) => setCapDollars(e.target.value)}
        />
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="lh-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="lh-btn-primary"
          onClick={() => create.mutate()}
          disabled={!name || create.isPending}
        >
          Save goal
        </button>
      </div>
    </div>
  );
}
