/**
 * Spend-over-time chart. Recharts area chart with a refined tooltip,
 * subtle gridlines, and a second-axis "count" overlay that's rendered as
 * dimmer dots to give density context without crowding the y-axis.
 */
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { fmtMoney, fmtMonth } from '../lib/format';

interface Datum {
  month: string;
  total_cents: number;
  count: number;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload[0]?.value ?? 0;
  const count = (payload[0]?.payload as { count?: number })?.count ?? 0;
  return (
    <div className="lh-card-elev px-3 py-2 text-xs shadow-cardHover">
      <div className="text-lh-mute lh-eyebrow">{label}</div>
      <div className="mt-1 font-semibold text-lh-fore lh-num text-base">
        {fmtMoney(Math.round(total * 100))}
      </div>
      <div className="text-lh-mute mt-0.5 tabular-nums">{count} receipts</div>
    </div>
  );
}

export default function SpendChart({ data }: { data: Datum[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="lh-card p-8 h-80 flex flex-col items-center justify-center text-center">
        <div className="text-sm font-medium text-lh-fore mb-1">No spend data yet</div>
        <div className="text-xs text-lh-mute max-w-xs">
          Run <code className="px-1.5 py-0.5 rounded bg-lh-line text-lh-fore font-mono">npm run sync</code> to extract receipts from your inbox.
        </div>
      </div>
    );
  }
  const chartData = data.map((d) => ({
    label: fmtMonth(d.month),
    total: d.total_cents / 100,
    count: d.count,
  }));
  // Compute the total for the header sub-stat.
  const total12mo = data.reduce((acc, d) => acc + d.total_cents, 0);
  const avg = total12mo / data.length;

  return (
    <div className="lh-card p-5 h-[340px] flex flex-col">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="lh-eyebrow">Spend</div>
          <div className="text-base font-semibold mt-1 text-lh-fore">By month, last 12 months</div>
        </div>
        <div className="text-right">
          <div className="text-2xs text-lh-mute uppercase tracking-wider">Average</div>
          <div className="lh-num text-base font-semibold mt-0.5">{fmtMoney(Math.round(avg))}</div>
        </div>
      </div>
      <div className="flex-1 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e58e5a" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#e58e5a" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#e58e5a" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="label"
              stroke="#8a91a0"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              dy={6}
            />
            <YAxis
              stroke="#8a91a0"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e58e5a', strokeOpacity: 0.3, strokeDasharray: '3 3' }} />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#e58e5a"
              strokeWidth={2}
              fill="url(#sg)"
              activeDot={{ r: 5, stroke: '#e58e5a', strokeWidth: 2, fill: '#08090c' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
