/**
 * Side-by-side month comparison at /compare?a=2026-04&b=2026-03.
 *
 * Defaults to "this month vs last month" if the query params are missing.
 * Shows: total + delta, by-category bars side-by-side, and the union
 * of top merchants ranked by absolute change.
 */
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import MerchantBadge from '../components/MerchantBadge';
import { CATEGORY_LABEL, categoryColor } from '../components/CategoryBreakdown';
import { api } from '../lib/api';
import { fmtMoney, fmtMonth } from '../lib/format';

interface MonthSlice {
  yyyy_mm: string;
  total_cents: number;
  count: number;
  categories: { category: string; total_cents: number; count: number }[];
  top_merchants: { merchant_id: number; display_name: string; total_cents: number; count: number }[];
}

function defaultMonths(): { a: string; b: string } {
  const now = new Date();
  const a = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const b = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  return { a, b };
}

function shiftMonth(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split('-').map((s) => Number.parseInt(s, 10));
  const d = new Date(y!, m! - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const def = defaultMonths();
  const aKey = searchParams.get('a') ?? def.a;
  const bKey = searchParams.get('b') ?? def.b;

  const a = useQuery({
    queryKey: ['month-slice', aKey],
    queryFn: () => api<MonthSlice>(`/api/month/${aKey}`),
  });
  const b = useQuery({
    queryKey: ['month-slice', bKey],
    queryFn: () => api<MonthSlice>(`/api/month/${bKey}`),
  });

  function setMonth(side: 'a' | 'b', value: string) {
    const next = new URLSearchParams(searchParams);
    next.set(side, value);
    setSearchParams(next);
  }

  if (!a.data || !b.data) {
    return (
      <div>
        <PageHeader title="Compare months" />
        <div className="p-8 lh-skeleton h-40 w-full" />
      </div>
    );
  }
  const totalDelta = b.data.total_cents > 0
    ? ((a.data.total_cents - b.data.total_cents) / b.data.total_cents) * 100
    : 0;

  // Category union with deltas, ranked by |delta_cents|.
  const catMap = new Map<string, { a: number; b: number }>();
  a.data.categories.forEach((c) => {
    catMap.set(c.category, { a: c.total_cents, b: 0 });
  });
  b.data.categories.forEach((c) => {
    const ex = catMap.get(c.category);
    if (ex) ex.b = c.total_cents;
    else catMap.set(c.category, { a: 0, b: c.total_cents });
  });
  const cats = [...catMap.entries()]
    .map(([k, v]) => ({ category: k, a: v.a, b: v.b, delta: v.a - v.b }))
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  const catMax = Math.max(1, ...cats.map((c) => Math.max(c.a, c.b)));

  // Merchant union, ranked by |delta_cents|.
  const merchMap = new Map<number, { name: string; a: number; b: number }>();
  a.data.top_merchants.forEach((m) => {
    merchMap.set(m.merchant_id, { name: m.display_name, a: m.total_cents, b: 0 });
  });
  b.data.top_merchants.forEach((m) => {
    const ex = merchMap.get(m.merchant_id);
    if (ex) ex.b = m.total_cents;
    else merchMap.set(m.merchant_id, { name: m.display_name, a: 0, b: m.total_cents });
  });
  const merchants = [...merchMap.entries()]
    .map(([id, v]) => ({ id, ...v, delta: v.a - v.b }))
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, 8);

  return (
    <div>
      <PageHeader
        eyebrow="Analyze"
        title="Compare months"
        description="See exactly what changed, line item by line item."
      />
      <div className="p-8 space-y-6 max-w-5xl">
        {/* Headers + month pickers */}
        <div className="grid grid-cols-2 gap-6">
          <MonthPicker label="A" value={aKey} onChange={(v) => setMonth('a', v)} />
          <MonthPicker label="B" value={bKey} onChange={(v) => setMonth('b', v)} />
        </div>

        {/* Hero compare */}
        <div className="grid grid-cols-2 gap-6">
          <Hero
            label={fmtMonth(aKey)}
            total={a.data.total_cents}
            count={a.data.count}
            highlighted
          />
          <Hero label={fmtMonth(bKey)} total={b.data.total_cents} count={b.data.count} />
        </div>

        {/* Big delta banner */}
        <div className="lh-card p-5 flex items-center gap-4">
          <DeltaIcon pct={totalDelta} />
          <div className="flex-1">
            <div className="lh-eyebrow">Total change</div>
            <div className="text-base font-semibold mt-1 text-lh-fore">
              {fmtMonth(aKey)} vs {fmtMonth(bKey)}:{' '}
              <span className={totalDelta > 0 ? 'text-lh-rose' : 'text-lh-mint'}>
                {totalDelta > 0 ? '+' : ''}
                {totalDelta.toFixed(1)}%
              </span>
              <span className="text-lh-mute lh-num">
                {' '}
                ({fmtMoney(a.data.total_cents - b.data.total_cents)} difference)
              </span>
            </div>
          </div>
        </div>

        {/* Categories side-by-side */}
        <div className="lh-card p-5">
          <div className="lh-eyebrow mb-3">Category change, biggest swings first</div>
          <div className="space-y-2.5">
            {cats.map((c) => (
              <CategoryRow key={c.category} c={c} max={catMax} />
            ))}
          </div>
        </div>

        {/* Merchants */}
        <div className="lh-card p-5">
          <div className="lh-eyebrow mb-3">Top merchants by change</div>
          <table className="w-full text-sm">
            <thead className="lh-eyebrow text-2xs">
              <tr>
                <th className="text-left py-2 font-medium">Merchant</th>
                <th className="text-right py-2 font-medium">{fmtMonth(aKey)}</th>
                <th className="text-right py-2 font-medium">{fmtMonth(bKey)}</th>
                <th className="text-right py-2 font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((m) => (
                <tr key={m.id} className="border-t border-lh-line/30">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2.5">
                      <MerchantBadge name={m.name} size="sm" />
                      <span className="text-lh-fore">{m.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right lh-num">{fmtMoney(m.a)}</td>
                  <td className="py-2.5 text-right lh-num text-lh-mute">{fmtMoney(m.b)}</td>
                  <td
                    className={`py-2.5 text-right lh-num font-medium ${
                      m.delta > 0
                        ? 'text-lh-rose'
                        : m.delta < 0
                          ? 'text-lh-mint'
                          : 'text-lh-mute'
                    }`}
                  >
                    {m.delta > 0 ? '+' : ''}
                    {fmtMoney(m.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MonthPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="lh-btn-icon"
        onClick={() => onChange(shiftMonth(value, -1))}
        aria-label="Previous month"
      >
        ‹
      </button>
      <div className="lh-card-elev px-3 py-1.5 flex items-center gap-2 flex-1 justify-center">
        <span className="lh-eyebrow text-[10px]">{label}</span>
        <span className="text-sm font-medium text-lh-fore">{fmtMonth(value)}</span>
      </div>
      <button
        type="button"
        className="lh-btn-icon"
        onClick={() => onChange(shiftMonth(value, 1))}
        aria-label="Next month"
      >
        ›
      </button>
    </div>
  );
}

function Hero({
  label,
  total,
  count,
  highlighted = false,
}: {
  label: string;
  total: number;
  count: number;
  highlighted?: boolean;
}) {
  return (
    <div className={`lh-card p-5 ${highlighted ? 'border-lh-coral/30 shadow-glow' : ''}`}>
      <div className="lh-eyebrow">{label}</div>
      <div className="text-3xl font-semibold tracking-tightest mt-2 lh-num text-lh-fore">
        {fmtMoney(total)}
      </div>
      <div className="text-xs text-lh-mute mt-1 lh-num">
        {count.toLocaleString()} receipt{count === 1 ? '' : 's'}
      </div>
    </div>
  );
}

function DeltaIcon({ pct }: { pct: number }) {
  if (Math.abs(pct) < 0.5) {
    return (
      <div className="w-10 h-10 rounded-full bg-lh-line/40 flex items-center justify-center text-lh-mute">
        <Minus size={16} />
      </div>
    );
  }
  if (pct > 0) {
    return (
      <div className="w-10 h-10 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-300">
        <ArrowUpRight size={16} />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-300">
      <ArrowDownRight size={16} />
    </div>
  );
}

function CategoryRow({
  c,
  max,
}: {
  c: { category: string; a: number; b: number; delta: number };
  max: number;
}) {
  const aPct = (c.a / max) * 100;
  const bPct = (c.b / max) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm mb-1">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm" style={{ background: categoryColor(c.category) }} />
          <span className="text-lh-fore">{CATEGORY_LABEL[c.category] ?? c.category}</span>
        </span>
        <span
          className={`lh-num text-2xs font-medium ${
            c.delta > 0 ? 'text-lh-rose' : c.delta < 0 ? 'text-lh-mint' : 'text-lh-mute'
          }`}
        >
          {c.delta > 0 ? '+' : ''}
          {fmtMoney(c.delta)}
        </span>
      </div>
      <div className="space-y-1">
        <div className="grid grid-cols-[40px_1fr_72px] gap-2 items-center text-2xs">
          <span className="text-lh-mute">A</span>
          <div className="h-1.5 rounded-full bg-lh-line/60 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, aPct)}%`, background: categoryColor(c.category) }}
            />
          </div>
          <span className="text-right lh-num">{fmtMoney(c.a)}</span>
        </div>
        <div className="grid grid-cols-[40px_1fr_72px] gap-2 items-center text-2xs">
          <span className="text-lh-mute">B</span>
          <div className="h-1.5 rounded-full bg-lh-line/60 overflow-hidden">
            <div
              className="h-full rounded-full opacity-60"
              style={{ width: `${Math.max(2, bPct)}%`, background: categoryColor(c.category) }}
            />
          </div>
          <span className="text-right lh-num text-lh-mute">{fmtMoney(c.b)}</span>
        </div>
      </div>
    </div>
  );
}
