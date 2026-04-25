/**
 * Display helpers for the dashboard.
 */
import { format, formatDistanceToNow } from 'date-fns';

export function fmtMoney(cents: number, currency = 'USD'): string {
  const major = cents / 100;
  // For currencies we know about, use Intl. For unknowns, just print code.
  if (currency === 'UNK' || !currency) return major.toFixed(2);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: major === Math.floor(major) ? 0 : 2,
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

export function fmtDate(ms: number): string {
  return format(new Date(ms), 'MMM d, yyyy');
}

export function fmtDateShort(ms: number): string {
  return format(new Date(ms), 'MMM d');
}

export function fmtRelative(ms: number): string {
  return formatDistanceToNow(new Date(ms), { addSuffix: true });
}

export function fmtMonth(yyyymm: string): string {
  // 'YYYY-MM' → 'Jan 2025'
  const [y, m] = yyyymm.split('-');
  if (!y || !m) return yyyymm;
  return format(new Date(Number(y), Number(m) - 1, 1), 'MMM yyyy');
}

export function classifyStatusColor(s: string): string {
  switch (s) {
    case 'active':    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'cancelled': return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
    case 'trial':     return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
    default:          return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
  }
}

export function alertColor(type: string): string {
  switch (type) {
    case 'trial_ending':     return 'border-amber-500/30 bg-amber-500/5';
    case 'price_increase':   return 'border-rose-500/30 bg-rose-500/5';
    case 'new_subscription': return 'border-emerald-500/30 bg-emerald-500/5';
    case 'duplicate_charge': return 'border-violet-500/30 bg-violet-500/5';
    default: return 'border-lh-line';
  }
}
