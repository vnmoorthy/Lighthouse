/**
 * Merchant rule lookup tests.
 *
 * These tests don't touch the DB or LLM — they check the deterministic
 * domain/alias rules in merchant_rules.ts.
 */
import { describe, it, expect } from 'vitest';
import { findRuleMatch } from '../packages/core/src/domain/merchant_rules.js';

describe('merchant rules', () => {
  it('matches by from-domain', () => {
    expect(findRuleMatch('whatever', 'auto-confirm@amazon.com')?.canonical).toBe('amazon');
    expect(findRuleMatch('SPOTIFY USA', 'no-reply@spotify.com')?.canonical).toBe('spotify');
    expect(findRuleMatch('netflix', 'info@netflix.com')?.canonical).toBe('netflix');
  });

  it('matches by alias regex when domain is unknown', () => {
    expect(findRuleMatch('AMZN Mktp US*1A2B3', 'foo@bar.com')?.canonical).toBe('amazon');
    expect(findRuleMatch('UBER *EATS', 'foo@bar.com')?.canonical).toBe('uber-eats');
    expect(findRuleMatch('DD *DOORDASH SCRIBBL', 'foo@bar.com')?.canonical).toBe('doordash');
  });

  it('returns null for unknown merchants', () => {
    expect(findRuleMatch('Zozo Corp', 'foo@example.org')).toBeNull();
  });
});
