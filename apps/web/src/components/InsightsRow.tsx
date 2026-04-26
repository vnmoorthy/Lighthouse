/**
 * Inline row of "did you notice…?" insight cards. Hidden when there are
 * none — empty silence is better than a row of obvious truisms.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Sparkles, TrendingUp, TrendingDown, Calendar, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';

interface Insight {
  kind: 'category_change' | 'first_time_merchant' | 'category_streak' | 'big_day';
  headline: string;
  detail?: string;
  href?: string;
  weight: number;
}

function Icon({ kind, headline }: { kind: Insight['kind']; headline: string }) {
  const cls = 'shrink-0';
  if (kind === 'first_time_merchant') return <Sparkles size={14} className={`${cls} text-emerald-300`} strokeWidth={1.75} />;
  if (kind === 'big_day') return <Calendar size={14} className={`${cls} text-amber-300`} strokeWidth={1.75} />;
  if (kind === 'category_streak') return <TrendingUp size={14} className={`${cls} text-rose-300`} strokeWidth={1.75} />;
  // category_change: pick by direction
  if (kind === 'category_change') {
    return /down/i.test(headline) ? (
      <TrendingDown size={14} className={`${cls} text-emerald-300`} strokeWidth={1.75} />
    ) : (
      <TrendingUp size={14} className={`${cls} text-rose-300`} strokeWidth={1.75} />
    );
  }
  return null;
}

export default function InsightsRow() {
  const q = useQuery({
    queryKey: ['insights'],
    queryFn: () => api<{ insights: Insight[] }>('/api/insights'),
  });
  const ins = q.data?.insights ?? [];
  if (q.isLoading || ins.length === 0) return null;

  return (
    <div>
      <div className="lh-eyebrow mb-3 px-1">Things you might not have noticed</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ins.map((i, idx) => {
          const cls = `lh-card p-4 transition-all duration-200 group ${i.href ? 'hover:border-lh-line2 hover:bg-lh-slab2/40 cursor-pointer' : ''}`;
          const inner = (
            <div className="flex items-start gap-2.5">
              <Icon kind={i.kind} headline={i.headline} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-lh-fore leading-snug">{i.headline}</div>
                {i.detail ? <div className="text-2xs text-lh-mute mt-1">{i.detail}</div> : null}
              </div>
              {i.href ? (
                <ArrowRight size={12} className="text-lh-mute opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
              ) : null}
            </div>
          );
          return i.href ? (
            <Link key={idx} to={i.href} className={cls}>
              {inner}
            </Link>
          ) : (
            <div key={idx} className={cls}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
