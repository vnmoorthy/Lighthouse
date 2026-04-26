/**
 * Settings widget: list + create custom alert rules.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiPost, type MerchantItem } from '../lib/api';
import { Trash2, Plus, X } from 'lucide-react';
import { CATEGORY_LABEL } from './CategoryBreakdown';
import { fmtMoney, fmtRelative } from '../lib/format';

interface Rule {
  id: number;
  name: string;
  type: 'merchant_threshold' | 'category_threshold' | 'any_charge';
  payload: Record<string, unknown>;
  enabled: number;
  created_at: number;
  last_fired_at: number | null;
}

export default function CustomAlertsCard() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const rules = useQuery({
    queryKey: ['custom-rules'],
    queryFn: () => api<{ rules: Rule[] }>('/api/custom-rules'),
  });
  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/custom-rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-rules'] }),
  });

  const list = rules.data?.rules ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-2xs text-lh-mute">
          {list.length === 0
            ? 'No custom alerts yet.'
            : `${list.length} rule${list.length === 1 ? '' : 's'} active.`}
        </div>
        {!creating ? (
          <button type="button" className="lh-btn !py-1 !px-2 text-2xs" onClick={() => setCreating(true)}>
            <Plus size={12} /> New rule
          </button>
        ) : null}
      </div>

      {creating ? (
        <CreateForm
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void qc.invalidateQueries({ queryKey: ['custom-rules'] });
          }}
        />
      ) : null}

      {list.length > 0 ? (
        <div className="lh-card divide-y divide-lh-line/40">
          {list.map((r) => (
            <div key={r.id} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-lh-fore">{r.name}</div>
                <div className="text-2xs text-lh-mute mt-0.5">
                  {ruleSubtitle(r)}
                  {r.last_fired_at
                    ? ` · last fired ${fmtRelative(r.last_fired_at)}`
                    : ''}
                </div>
              </div>
              <button
                type="button"
                className="lh-btn-icon"
                onClick={() => remove.mutate(r.id)}
                aria-label="Delete rule"
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

function ruleSubtitle(r: Rule): string {
  if (r.type === 'merchant_threshold') {
    return `If spending at this merchant in the last ${r.payload.window_days}d exceeds ${fmtMoney(Number(r.payload.max_cents))}.`;
  }
  if (r.type === 'category_threshold') {
    return `If ${String(r.payload.category)} spend in the last ${r.payload.window_days}d exceeds ${fmtMoney(Number(r.payload.max_cents))}.`;
  }
  return `If any single charge at this merchant ≥ ${fmtMoney(Number(r.payload.min_cents))}.`;
}

function CreateForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<Rule['type']>('merchant_threshold');
  const [merchantId, setMerchantId] = useState('');
  const [category, setCategory] = useState('food');
  const [maxDollars, setMaxDollars] = useState('100');
  const [windowDays, setWindowDays] = useState('30');
  const [error, setError] = useState<string | null>(null);

  const merchants = useQuery({
    queryKey: ['rule-merchants'],
    queryFn: () => api<{ merchants: MerchantItem[] }>('/api/merchants'),
  });

  const create = useMutation({
    mutationFn: () => {
      let payload: Record<string, unknown>;
      if (type === 'merchant_threshold') {
        payload = {
          merchant_id: Number.parseInt(merchantId, 10),
          max_cents: Math.round(Number.parseFloat(maxDollars) * 100),
          window_days: Number.parseInt(windowDays, 10),
        };
      } else if (type === 'category_threshold') {
        payload = {
          category,
          max_cents: Math.round(Number.parseFloat(maxDollars) * 100),
          window_days: Number.parseInt(windowDays, 10),
        };
      } else {
        payload = {
          merchant_id: Number.parseInt(merchantId, 10),
          min_cents: Math.round(Number.parseFloat(maxDollars) * 100),
        };
      }
      return apiPost<{ id: number }>('/api/custom-rules', { name, type, payload });
    },
    onSuccess: () => onCreated(),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="lh-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-lh-fore">New rule</div>
        <button type="button" className="lh-btn-icon" onClick={onClose} aria-label="Close">
          <X size={13} />
        </button>
      </div>

      <input
        className="lh-input w-full"
        placeholder="Rule name (e.g. 'Coffee budget')"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <select
        className="lh-select w-full"
        value={type}
        onChange={(e) => setType(e.target.value as Rule['type'])}
      >
        <option value="merchant_threshold">Merchant threshold (per window)</option>
        <option value="category_threshold">Category threshold (per window)</option>
        <option value="any_charge">Any charge above $X at a merchant</option>
      </select>

      {type === 'merchant_threshold' || type === 'any_charge' ? (
        <select
          className="lh-select w-full"
          value={merchantId}
          onChange={(e) => setMerchantId(e.target.value)}
        >
          <option value="">Pick a merchant…</option>
          {(merchants.data?.merchants ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      ) : null}

      {type === 'category_threshold' ? (
        <select
          className="lh-select w-full"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {Object.entries(CATEGORY_LABEL).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="lh-eyebrow text-[10px]">{type === 'any_charge' ? 'Min amount ($)' : 'Threshold ($)'}</span>
          <input
            type="number"
            min="1"
            className="lh-input w-full mt-1"
            value={maxDollars}
            onChange={(e) => setMaxDollars(e.target.value)}
          />
        </label>
        {type !== 'any_charge' ? (
          <label className="block">
            <span className="lh-eyebrow text-[10px]">Window (days)</span>
            <input
              type="number"
              min="1"
              max="365"
              className="lh-input w-full mt-1"
              value={windowDays}
              onChange={(e) => setWindowDays(e.target.value)}
            />
          </label>
        ) : null}
      </div>

      {error ? <div className="text-2xs text-rose-300">{error}</div> : null}

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
          Save rule
        </button>
      </div>
    </div>
  );
}
