/**
 * Spend-over-time line chart. Recharts. Smoothed mono curve, gold fill.
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
import { fmtMoney, fmtMonth } from '../lib/format';

interface Datum {
  month: string;
  total_cents: number;
  count: number;
}

export default function SpendChart({ data }: { data: Datum[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="lh-card p-6 h-72 flex items-center justify-center text-sm text-lh-mute">
        Spend data will appear here once your first sync finishes.
      </div>
    );
  }
  const chartData = data.map((d) => ({
    label: fmtMonth(d.month),
    total: d.total_cents / 100,
    count: d.count,
  }));
  return (
    <div className="lh-card p-5 h-80">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Spend by month</div>
        <div className="text-xs text-lh-mute">{data.length} months · all merchants</div>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1f2937" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#94a3b8"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#1f2937' }}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#1f2937' }}
            tickFormatter={(v: number) => `$${Math.round(v)}`}
            width={60}
          />
          <Tooltip
            cursor={{ stroke: '#fbbf24', strokeOpacity: 0.4 }}
            contentStyle={{
              background: '#0f1623',
              border: '1px solid #1f2937',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number, name: string) =>
              name === 'total' ? [fmtMoney(Math.round(v * 100)), 'Total'] : [v, name]
            }
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#fbbf24"
            strokeWidth={2}
            fill="url(#sg)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
