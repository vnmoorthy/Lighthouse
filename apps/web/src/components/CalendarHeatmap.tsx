/**
 * GitHub-style contribution heatmap. 53 weeks × 7 days. Each cell is
 * tinted by amount spent that day. Empty cells are very faintly visible
 * so the grid still reads as a year.
 *
 * Designed to take exactly the rows that come back from the merchant
 * timeline endpoint — so we don't have to fan out to a separate API.
 */
import { useMemo } from 'react';
import { fmtDate, fmtMoney } from '../lib/format';

interface Entry {
  date: number;
  amount_cents: number;
  currency: string;
}

const WEEKS = 53;
const DAY_NAMES = ['Mon', '', 'Wed', '', 'Fri', '', ''];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tintFor(amount: number, max: number): string {
  if (amount <= 0) return 'rgba(255,255,255,0.04)';
  const ratio = max > 0 ? Math.min(1, amount / max) : 0;
  // Coral gradient. 5 levels for readability.
  const stops = [
    'rgba(229, 142, 90, 0.18)',
    'rgba(229, 142, 90, 0.35)',
    'rgba(229, 142, 90, 0.55)',
    'rgba(229, 142, 90, 0.75)',
    'rgba(229, 142, 90, 0.95)',
  ];
  const idx = Math.max(0, Math.min(stops.length - 1, Math.floor(ratio * stops.length)));
  return stops[idx]!;
}

export default function CalendarHeatmap({ entries }: { entries: Entry[] }) {
  // Bucket by day (sum of amounts)
  const byDay = useMemo(() => {
    const m = new Map<string, { amount: number; count: number; currency: string }>();
    for (const e of entries) {
      const key = dayKey(e.date);
      const prev = m.get(key);
      if (prev) {
        prev.amount += Math.abs(e.amount_cents);
        prev.count += 1;
      } else {
        m.set(key, { amount: Math.abs(e.amount_cents), count: 1, currency: e.currency });
      }
    }
    return m;
  }, [entries]);

  // Build the grid: anchor on today, walk back 53 weeks.
  const today = new Date();
  // Snap to Sunday at the right edge (last column).
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() + (6 - today.getDay()));
  // Aligned to the *Sunday on or after today*. Cells for days after today
  // will be rendered as "future" (no fill).

  const cells: { date: Date; key: string; isFuture: boolean }[][] = [];
  let max = 0;
  for (const v of byDay.values()) if (v.amount > max) max = v.amount;

  for (let col = WEEKS - 1; col >= 0; col--) {
    const week: { date: Date; key: string; isFuture: boolean }[] = [];
    for (let row = 0; row < 7; row++) {
      const offsetDays = col * 7 + (6 - row);
      const d = new Date(lastSunday);
      d.setDate(lastSunday.getDate() - offsetDays);
      week.push({ date: d, key: dayKey(d.getTime()), isFuture: d.getTime() > today.getTime() });
    }
    cells.unshift(week);
  }

  // Compute month label positions (first Sunday of each month).
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  cells.forEach((week, col) => {
    const d = week[0]!.date; // First day of the column (Mon-aligned visually)
    if (d.getMonth() !== lastMonth) {
      monthLabels.push({ col, label: MONTH_NAMES[d.getMonth()]! });
      lastMonth = d.getMonth();
    }
  });

  return (
    <div className="lh-card p-5">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="lh-eyebrow">Heat map</div>
          <div className="text-base font-semibold mt-1 text-lh-fore">
            Every transaction, last 12 months
          </div>
        </div>
        <Legend />
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-full">
          {/* Month labels */}
          <div className="grid grid-flow-col auto-cols-[14px] gap-[3px] pl-7 mb-1">
            {cells.map((_, col) => {
              const label = monthLabels.find((m) => m.col === col);
              return (
                <div
                  key={col}
                  className="text-[9px] text-lh-mute h-3 leading-3"
                  style={{ visibility: label ? 'visible' : 'hidden' }}
                >
                  {label?.label ?? ''}
                </div>
              );
            })}
          </div>
          <div className="flex gap-[3px]">
            {/* Day-of-week column */}
            <div className="grid grid-rows-7 gap-[3px] pr-2">
              {DAY_NAMES.map((d, i) => (
                <div key={i} className="text-[9px] text-lh-mute h-[14px] leading-[14px] tabular-nums">
                  {d}
                </div>
              ))}
            </div>
            {/* Cells */}
            <div className="grid grid-flow-col auto-cols-[14px] grid-rows-7 gap-[3px]">
              {cells.map((week) =>
                week.map((cell) => {
                  const v = byDay.get(cell.key);
                  const fill = cell.isFuture ? 'transparent' : tintFor(v?.amount ?? 0, max);
                  const tip = v
                    ? `${fmtDate(cell.date.getTime())} · ${fmtMoney(v.amount, v.currency)} · ${v.count} purchase${v.count === 1 ? '' : 's'}`
                    : fmtDate(cell.date.getTime());
                  return (
                    <div
                      key={cell.key}
                      className="w-[14px] h-[14px] rounded-[3px] transition-colors duration-150 hover:ring-1 hover:ring-lh-coral cursor-default"
                      style={{ background: fill, border: cell.isFuture ? '1px dashed rgba(255,255,255,0.04)' : 'none' }}
                      title={tip}
                    />
                  );
                }),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend() {
  const stops = [
    'rgba(255,255,255,0.04)',
    'rgba(229, 142, 90, 0.18)',
    'rgba(229, 142, 90, 0.35)',
    'rgba(229, 142, 90, 0.55)',
    'rgba(229, 142, 90, 0.75)',
    'rgba(229, 142, 90, 0.95)',
  ];
  return (
    <div className="flex items-center gap-1.5 text-2xs text-lh-mute">
      Less
      {stops.map((c, i) => (
        <span key={i} className="w-2.5 h-2.5 rounded-[3px]" style={{ background: c }} />
      ))}
      More
    </div>
  );
}
