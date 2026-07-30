import { describe, test, expect } from 'vitest';
import { computePolicyScore } from '../score.js';
import { matchInsurer } from '../insurer-matcher.js';
import type { ExtractedClause } from '../index.js';

function clause(overrides: Partial<ExtractedClause> & { fieldsJson: Record<string, unknown> }): ExtractedClause {
  return { clauseType: 'general', rawText: 'test clause text', pageNumber: 1, confidence: 'high', ...overrides };
}

describe('computePolicyScore — breakdown sums to displayed score', () => {
  test('no flags triggered: base score 100', () => {
    const result = computePolicyScore([clause({
      fieldsJson: { some_irrelevant_field: 'nothing that triggers a rule' },
    })], 'Some Insurer');
    expect(result.score).toBe(100);
    expect(Object.keys(result.breakdown).length).toBe(0);
  });

  test('R02 + R03 triggered: score = 100 - 25 - 15 = 60', () => {
    const clauses = [clause({
      clauseType: 'sub_limit',
      fieldsJson: {
        sum_insured: 500000,
        sub_limits: [{ procedure: 'Cataract', cap_value: 25000, cap_type: 'fixed_amount' }],
        co_pay: { percentage: 20, age_linked: false },
      },
    })];
    const result = computePolicyScore(clauses, 'Test Insurer');
    const expectedScore = 100 - 25 - 15;
    expect(result.score).toBe(expectedScore);
    expect(result.breakdown.R02).toBe(-25);
    expect(result.breakdown.R03).toBe(-15);
    const breakdownSum = Object.values(result.breakdown).reduce((a, b) => a + b, 0);
    expect(100 + breakdownSum).toBe(expectedScore);
  });

  test('R04 (critical) + G04 (green bonus): score = 100 - 25 + 5 = 80', () => {
    const clauses = [clause({
      clauseType: 'waiting_period',
      fieldsJson: {
        waiting_periods: [{ condition: 'PED', period_months: 48, period_type: 'ped' }],
        restoration_benefit: { present: true },
      },
    })];
    const result = computePolicyScore(clauses, 'Test Insurer');
    expect(result.score).toBe(80);
    expect(result.breakdown.R04).toBe(-25);
    expect(result.breakdown.G04).toBe(5);
    const breakdownSum = Object.values(result.breakdown).reduce((a, b) => a + b, 0);
    expect(100 + breakdownSum).toBe(80);
  });

  test('multiple red flags stacking: score floors at 0', () => {
    const clauses = [clause({
      clauseType: 'sub_limit',
      fieldsJson: {
        sum_insured: 500000,
        sub_limits: [{ procedure: 'Cataract', cap_value: 25000, cap_type: 'fixed_amount' }],
        co_pay: { percentage: 20 },
        room_rent_clause: { cap_type: 'percent_of_sum_insured', cap_value: 2, proportionate_deduction: true },
        waiting_periods: [{ condition: 'PED', period_months: 48, period_type: 'ped' }],
        non_disclosure_clause_present: true,
        non_disclosure_scope: 'broad_any_non_disclosure',
        exclusions: [{ condition: 'Congenital disease', is_permanent: true }],
      },
    })];
    const result = computePolicyScore(clauses, 'Test Insurer');
    expect(result.score).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  test('Single clause triggers both R02 and R06: score = 100 - 25 - 15 = 60', () => {
    const clauses = [clause({
      clauseType: 'waiting_period_and_sub_limit',
      fieldsJson: {
        sum_insured: 500000,
        sub_limits: [{ procedure: 'Cataract', cap_value: 25000, cap_type: 'fixed_amount' }],
        waiting_periods: [{ condition: 'Cataract', period_months: 12, period_type: 'specific_disease' }],
      },
    })];
    const result = computePolicyScore(clauses, 'Test Insurer');
    expect(result.score).toBe(60);
    expect(result.breakdown.R02).toBe(-25);
    expect(result.breakdown.R06).toBe(-15);
    const sum = Object.values(result.breakdown).reduce((a, b) => a + b, 0);
    expect(100 + sum).toBe(60);
  });
});

describe('Settlement ratio — display-only, never blended', () => {
  test('settlementRatio is present alongside score but not part of breakdown', () => {
    const result = computePolicyScore([clause({
      fieldsJson: { co_pay: { percentage: 20 } },
    })], 'ICICI Lombard General Insurance');
    expect(result.score).toBe(85);
    expect(result.settlementRatio).toBe(82.24);
    expect(result.breakdown).not.toHaveProperty('settlementRatio');
  });

  test('null for unknown insurer', () => {
    const result = computePolicyScore([clause({
      fieldsJson: {},
    })], 'Fictional Insurance Company Ltd');
    expect(result.settlementRatio).toBeNull();
    expect(result.settlementRatioMatchedInsurer).toBeNull();
  });

  test('null for no insurer name', () => {
    const result = computePolicyScore([clause({
      fieldsJson: {},
    })], null);
    expect(result.settlementRatio).toBeNull();
  });
});

describe('matchInsurer — fuzzy matching', () => {
  test('exact match returns ICR', () => {
    const r = matchInsurer('ICICI Lombard General Insurance');
    expect(r.icrPct).toBe(82.24);
    expect(r.matchedName).toBe('ICICI Lombard General Insurance');
  });

  test('partial name with stripped suffix matches', () => {
    const r = matchInsurer('Bajaj Allianz');
    expect(r.icrPct).toBe(87.31);
  });

  test('name with "Ltd" suffix matches', () => {
    const r = matchInsurer('HDFC ERGO General Insurance Ltd');
    expect(r.icrPct).toBe(84.85);
  });

  test('name with "Insurance Co" suffix matches', () => {
    const r = matchInsurer('SBI General Insurance Co.');
    expect(r.icrPct).toBe(82.19);
  });

  test('case insensitive', () => {
    const r = matchInsurer('hdfc ergo general insurance');
    expect(r.icrPct).toBe(84.85);
  });

  test('completely unknown returns null', () => {
    const r = matchInsurer('XYZ Corp');
    expect(r.icrPct).toBeNull();
    expect(r.matchedName).toBeNull();
  });

  test('null input returns null', () => {
    const r = matchInsurer(null);
    expect(r.icrPct).toBeNull();
  });

  test('undefined input returns null', () => {
    const r = matchInsurer(undefined);
    expect(r.icrPct).toBeNull();
  });
});

describe('Score response shape', () => {
  test('response includes all required fields', () => {
    const result = computePolicyScore([clause({
      fieldsJson: { co_pay: { percentage: 20 } },
    })], 'ICICI Lombard');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('maxScore');
    expect(result).toHaveProperty('minScore');
    expect(result).toHaveProperty('breakdown');
    expect(result).toHaveProperty('settlementRatio');
    expect(result).toHaveProperty('settlementRatioMatchedInsurer');
    expect(result).toHaveProperty('settlementRatioSourceLabel');
    expect(result).toHaveProperty('settlementRatioReportingPeriod');
    expect(result).toHaveProperty('flags');
  });

  test('maxScore is 100 and minScore is 0', () => {
    const result = computePolicyScore([clause({ fieldsJson: {} })], null);
    expect(result.maxScore).toBe(100);
    expect(result.minScore).toBe(0);
  });
});