/**
 * Custom money-flow visualisation. Not a true Sankey (those need iterative
 * layout) but a "river" view: All spending → top categories → top merchants
 * within each category, drawn as proportional ribbons.
 *
 * Uses the existing /api/summary categories + top_merchants. Filters
 * merchants into their owning category by best-effort lookup against
 * the merchants endpoint.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type SummaryResponse, type MerchantItem } from '../lib/api';
import { CATEGORY_LABEL, categoryColor, categoryLabel } from './CategoryBreakdown';
import { fmtMoney } from '../lib/format';

const W = 800;
const H = 380;
const COL_W = 220;
const PAD = 4;

export default function MoneyFlowSankey() {
  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: () => api<SummaryResponse>('/api/summary'),
  });
  const merchants = useQuery({
    queryKey: ['merchants'],
    queryFn: () => api<{ merchants: MerchantItem[] }>('/api/merchants'),
  });

  const layout = useMemo(() => {
    if (!summary.data || !merchants.data) return null;
    const cats = [...summary.data.categories]
      .filter((c) => c.total_cents > 0)
      .sort((a, b) => b.total_cents - a.total_cents)
      .slice(0, 6);
    if (cats.length === 0) return null;
    const total = cats.reduce((acc, c) => acc + c.total_cents, 0);

    const mById = new Map(merchants.data.merchants.map((m) => [m.id, m]));
    // Assemble (category -> top-N merchants) approximation by walking the
    // top_merchants list and bucketing by category.
    const merchantsByCat = new Map<string, { id: number; name: string; total_cents: number }[]>();
    for (const tm of summary.data.top_merchants) {
      const m = mById.get(tm.merchant_id);
      const cat = m?.category ?? 'other';
      const arr = merchantsByCat.get(cat) ?? [];
      arr.push({ id: tm.merchant_id, name: tm.display_name, total_cents: tm.total_cents });
      merchantsByCat.set(cat, arr);
    }

    // Vertical layout — each category gets a band proportional to its share.
    let y = 0;
    const catBands = cats.map((c) => {
      const h = Math.max(8, ((H - 24) * c.total_cents) / total - PAD);
      const band = { ...c, y, h };
      y += h + PAD;
      return band;
    });

    // For each category, top merchants split its band proportionally.
    const flows: {
      catKey: string;
      catY0: number;
      catY1: number;
      mY0: number;
      mY1: number;
      color: string;
      name: string;
      cents: number;
    }[] = [];
    const merchantBands: { name: string; y: number; h: number; color: string; cents: number }[] = [];
    let mY = 0;
    for (const band of catBands) {
      const list = (merchantsByCat.get(band.category) ?? []).slice(0, 4);
      const listSum = list.reduce((acc, m) => acc + m.total_cents, 0) || 1;
      let yInBand = band.y;
      for (const m of list) {
        const segH = (band.h * m.total_cents) / listSum;
        const mH = Math.max(6, segH - PAD * 0.4);
        flows.push({
          catKey: band.category,
          catY0: yInBand,
          catY1: yInBand + segH,
          mY0: mY,
          mY1: mY + mH,
          color: categoryColor(band.category),
          name: m.name,
          cents: m.total_cents,
        });
        merchantBands.push({ name: m.name, y: mY, h: mH, color: categoryColor(band.category), cents: m.total_cents });
        yInBand += segH;
        mY += mH + PAD * 0.4;
      }
    }

    return { catBands, merchantBands, flows, total };
  }, [summary.data, merchants.data]);

  if (!layout) return null;
  if (layout.flows.length === 0) return null;

  const xCat0 = COL_W;
  const xCat1 = COL_W + 12;
  const xMer0 = W - COL_W - 12;
  const xMer1 = W - COL_W;

  return (
    <div className="lh-card p-5">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="lh-eyebrow">Money flow</div>
          <div className="text-base font-semibold mt-1 text-lh-fore">
            From category to merchant, last 12 months
          </div>
        </div>
        <div className="text-2xs text-lh-mute lh-num">
          Total: {fmtMoney(layout.total)}
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="min-w-[680px]">
          {/* Category labels (left column) */}
          {layout.catBands.map((b) => (
            <g key={b.category}>
              <rect
                x={xCat0}
                y={b.y}
                width={xCat1 - xCat0}
                height={b.h}
                fill={categoryColor(b.category)}
                opacity={0.85}
                rx={2}
              />
              <text
                x={xCat0 - 10}
                y={b.y + b.h / 2 + 4}
                fill="#eaeef5"
                fontSize="11"
                textAnchor="end"
                fontWeight="500"
              >
                {CATEGORY_LABEL[b.category] ?? categoryLabel(b.category)}
              </text>
              <text
                x={xCat0 - 10}
                y={b.y + b.h / 2 + 17}
                fill="#8a91a0"
                fontSize="9"
                textAnchor="end"
              >
                {fmtMoney(b.total_cents)}
              </text>
            </g>
          ))}

          {/* Flows */}
          {layout.flows.map((f, i) => {
            const path = ribbonPath(xCat1, f.catY0, f.catY1, xMer0, f.mY0, f.mY1);
            return (
              <path
                key={i}
                d={path}
                fill={f.color}
                opacity={0.35}
                className="hover:opacity-60 transition-opacity"
              >
                <title>{f.name}: {fmtMoney(f.cents)}</title>
              </path>
            );
          })}

          {/* Merchant labels (right column) */}
          {layout.merchantBands.map((b, i) => (
            <g key={i}>
              <rect
                x={xMer0}
                y={b.y}
                width={xMer1 - xMer0}
                height={b.h}
                fill={b.color}
                opacity={0.85}
                rx={2}
              />
              <text
                x={xMer1 + 10}
                y={b.y + b.h / 2 + 4}
                fill="#eaeef5"
                fontSize="11"
              >
                {b.name}
              </text>
              <text
                x={xMer1 + 10}
                y={b.y + b.h / 2 + 17}
                fill="#8a91a0"
                fontSize="9"
              >
                {fmtMoney(b.cents)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function ribbonPath(x0: number, y0a: number, y0b: number, x1: number, y1a: number, y1b: number): string {
  const cx0 = x0 + (x1 - x0) * 0.5;
  return [
    `M ${x0} ${y0a}`,
    `C ${cx0} ${y0a}, ${cx0} ${y1a}, ${x1} ${y1a}`,
    `L ${x1} ${y1b}`,
    `C ${cx0} ${y1b}, ${cx0} ${y0b}, ${x0} ${y0b}`,
    'Z',
  ].join(' ');
}
