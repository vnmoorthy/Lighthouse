/**
 * Category breakdown — a small donut chart with a legend list to the right.
 *
 * The donut is custom SVG (Recharts pie has visual quirks at the small
 * sizes we need). Each arc is interactive: hover dims others. Legend rows
 * are clickable to filter the Receipts page by category.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtMoney } from '../lib/format';

interface Datum {
  category: string;
  total_cents: number;
  count: number;
  merchant_count: number;
}

const CATEGORY_LABEL: Record<string, string> = {
  shopping: 'Shopping',
  groceries: 'Groceries',
  food: 'Food & dining',
  streaming: 'Streaming',
  productivity: 'Productivity',
  developer: 'Developer tools',
  fitness: 'Fitness & health',
  transit: 'Transit',
  travel: 'Travel',
  payments: 'Payments',
  utilities: 'Utilities',
  cloud: 'Cloud',
  news: 'News & media',
  apps: 'Apps',
  other: 'Other',
};

const CATEGORY_COLOR: Record<string, string> = {
  shopping: '#f5b94f',
  groceries: '#74c997',
  food: '#e88a91',
  streaming: '#b39de0',
  productivity: '#7cc1e9',
  developer: '#7fb1d9',
  fitness: '#a3d977',
  transit: '#f59e9e',
  travel: '#f5b94f',
  payments: '#9aa3b3',
  utilities: '#c4a66c',
  cloud: '#7cc1e9',
  news: '#b39de0',
  apps: '#e58e5a',
  other: '#5c6373',
};

function categoryColor(c: string): string {
  return CATEGORY_COLOR[c] ?? '#5c6373';
}

function categoryLabel(c: string): string {
  return CATEGORY_LABEL[c] ?? c[0]!.toUpperCase() + c.slice(1);
}

export default function CategoryBreakdown({ data }: { data: Datum[] }) {
  const [hover, setHover] = useState<string | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="lh-card p-8 h-[340px] flex flex-col items-center justify-center text-center">
        <div className="text-sm font-medium text-lh-fore mb-1">No spending categories yet</div>
        <div className="text-xs text-lh-mute max-w-xs">
          Categories appear once Lighthouse has extracted at least a few receipts.
        </div>
      </div>
    );
  }
  const total = data.reduce((acc, d) => acc + d.total_cents, 0);

  // Donut math
  const R = 64;
  const r = 44;
  const cx = 80;
  const cy = 80;
  let acc = 0;
  const arcs = data.map((d) => {
    const start = acc / total;
    acc += d.total_cents;
    const end = acc / total;
    return { ...d, start, end };
  });

  return (
    <div className="lh-card p-5 h-[340px] flex flex-col">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="lh-eyebrow">Category breakdown</div>
          <div className="text-base font-semibold mt-1 text-lh-fore">By spend, last 12 months</div>
        </div>
        <div className="text-2xs text-lh-mute lh-num">{data.length} categories</div>
      </div>
      <div className="flex-1 grid grid-cols-[160px_1fr] gap-4 min-h-0">
        <div className="relative flex items-center justify-center">
          <svg width={160} height={160} viewBox="0 0 160 160">
            <g transform="rotate(-90 80 80)">
              {arcs.map((a) => {
                const isHover = hover === a.category;
                const isOther = hover && !isHover;
                const stroke = R - r;
                const radius = (R + r) / 2;
                const totalCirc = 2 * Math.PI * radius;
                const segment = (a.end - a.start) * totalCirc;
                return (
                  <circle
                    key={a.category}
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    stroke={categoryColor(a.category)}
                    strokeWidth={stroke}
                    strokeDasharray={`${segment} ${totalCirc - segment}`}
                    strokeDashoffset={-a.start * totalCirc}
                    className="transition-opacity duration-200 cursor-pointer"
                    style={{ opacity: isOther ? 0.25 : 1 }}
                    onMouseEnter={() => setHover(a.category)}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </g>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <div className="lh-eyebrow text-[10px]">{hover ? categoryLabel(hover) : 'Total'}</div>
            <div className="text-base font-semibold lh-num text-lh-fore mt-0.5">
              {fmtMoney(hover ? data.find((d) => d.category === hover)!.total_cents : total)}
            </div>
          </div>
        </div>
        <div className="space-y-1.5 overflow-y-auto pr-1 -mr-1">
          {arcs.map((d) => {
            const pct = (d.total_cents / total) * 100;
            const isHover = hover === d.category;
            return (
              <Link
                to={`/receipts?category=${d.category}`}
                key={d.category}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${isHover ? 'bg-lh-line/40' : 'hover:bg-lh-line/30'}`}
                onMouseEnter={() => setHover(d.category)}
                onMouseLeave={() => setHover(null)}
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ background: categoryColor(d.category) }}
                />
                <span className="text-xs text-lh-fore flex-1 truncate">{categoryLabel(d.category)}</span>
                <span className="text-2xs text-lh-mute lh-num tabular-nums">{pct.toFixed(0)}%</span>
                <span className="text-xs text-lh-mute lh-num tabular-nums w-14 text-right">
                  {fmtMoney(d.total_cents)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { CATEGORY_LABEL, CATEGORY_COLOR, categoryColor, categoryLabel };
