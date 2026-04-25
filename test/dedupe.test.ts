import { describe, it, expect } from 'vitest';
import {
  cycleDays,
  relativeDiff,
  toMonthlyCents,
} from '../packages/core/src/domain/currency.js';

describe('currency utilities', () => {
  it('toMonthlyCents normalizes cycles', () => {
    expect(toMonthlyCents(1200, 'monthly')).toBe(1200);
    expect(toMonthlyCents(2400, 'quarterly')).toBe(800);
    expect(toMonthlyCents(12000, 'annually')).toBe(1000);
    expect(toMonthlyCents(300, 'weekly')).toBe(Math.round(300 * (52 / 12)));
  });

  it('cycleDays returns reasonable bucket lengths', () => {
    expect(cycleDays('weekly')).toBe(7);
    expect(cycleDays('monthly')).toBe(30);
    expect(cycleDays('annually')).toBe(365);
  });

  it('relativeDiff is symmetric and bounded', () => {
    expect(relativeDiff(100, 100)).toBe(0);
    expect(relativeDiff(100, 105)).toBeCloseTo(0.0476, 3);
    expect(relativeDiff(100, 200)).toBe(0.5);
    expect(relativeDiff(0, 0)).toBe(0);
  });
});
