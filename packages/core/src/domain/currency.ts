/**
 * Currency utilities — kept tiny on purpose.
 * The dashboard ships a richer formatter; this module is for shared logic
 * (cents → number, monthly cost normalization, dollar-aware comparisons).
 */
import type { BillingCycle } from './types.js';

export function centsToMajor(cents: number): number {
  return Math.round(cents) / 100;
}

/** Normalize any cycle's cost to a monthly equivalent. */
export function toMonthlyCents(amountCents: number, cycle: BillingCycle): number {
  switch (cycle) {
    case 'weekly':    return Math.round(amountCents * (52 / 12));
    case 'monthly':   return amountCents;
    case 'quarterly': return Math.round(amountCents / 3);
    case 'annually':  return Math.round(amountCents / 12);
    case 'unknown':   return amountCents; // best effort
  }
}

/** Days in a billing cycle, used for renewal-window math. */
export function cycleDays(cycle: BillingCycle): number {
  switch (cycle) {
    case 'weekly':    return 7;
    case 'monthly':   return 30;
    case 'quarterly': return 91;
    case 'annually':  return 365;
    case 'unknown':   return 30;
  }
}

/** Return |a-b| / max(|a|,|b|), 0..∞. Used to detect price changes. */
export function relativeDiff(a: number, b: number): number {
  const M = Math.max(Math.abs(a), Math.abs(b));
  if (M === 0) return 0;
  return Math.abs(a - b) / M;
}
