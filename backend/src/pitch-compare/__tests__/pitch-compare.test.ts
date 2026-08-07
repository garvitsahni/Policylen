import { describe, test, expect } from 'vitest';
import { comparePitch, type PitchClaim } from '../index.js';
import type { ExtractedClause } from '../../flag-engine/index.js';

function makeClause(overrides: Partial<ExtractedClause> = {}): ExtractedClause {
  return {
    id: 'clause-1',
    documentId: 'doc-1',
    clauseType: 'co_pay',
    rawText: 'Policy document excerpt for testing.',
    confidence: 0.95,
    fieldsJson: {},
    validatedAt: null,
    validationStatus: 'pending',
    ...overrides,
  };
}

describe('comparePitch', () => {
  test('detects contradiction when salesperson claims no co-pay but document has co-pay', () => {
    const clauses = [makeClause({
      clauseType: 'co_pay',
      fieldsJson: { co_pay: { percentage: 20, applicable_on: 'all_admissions' } } as Record<string, unknown>,
      rawText: 'A co-payment of 20% shall apply to all hospital admissions.',
    })];
    const pitch = 'This policy has zero copay, absolutely no out-of-pocket expenses!';
    const result = comparePitch(pitch, clauses);
    expect(result.contradictions.length).toBeGreaterThan(0);
    const copayContra = result.contradictions.find(c => c.claimType === 'co_pay');
    expect(copayContra).toBeDefined();
    expect(copayContra!.severity).toBe('contradiction');
  });

  test('confirms when salesperson correctly claims no co-pay and document has none', () => {
    const clauses = [makeClause({
      clauseType: 'co_pay',
      fieldsJson: {} as Record<string, unknown>,
      rawText: 'No co-payment clause applies.',
    })];
    const pitch = 'Zero copay!';
    const result = comparePitch(pitch, clauses);
    const copayContra = result.contradictions.find(c => c.claimType === 'co_pay');
    expect(copayContra).toBeDefined();
    expect(copayContra!.severity).toBe('match');
  });

  test('detects contradiction when salesperson claims no PED wait but document has 48-month wait', () => {
    const clauses = [makeClause({
      clauseType: 'ped_waiting_period_months',
      fieldsJson: { waiting_periods: [{ period_type: 'ped', period_months: 48 }] } as Record<string, unknown>,
      rawText: 'Pre-existing diseases shall be covered after a waiting period of 48 months.',
    })];
    const pitch = 'Your pre-existing conditions are covered from day 1, no waiting period!';
    const result = comparePitch(pitch, clauses);
    const pedContra = result.contradictions.find(c => c.claimType === 'ped_waiting');
    expect(pedContra).toBeDefined();
    expect(pedContra!.severity).toBe('contradiction');
    expect(pedContra!.explanation).toContain('48-month');
  });

  test('detects contradiction when salesperson claims no sub-limits but document has them', () => {
    const clauses = [makeClause({
      clauseType: 'clause_with_sub_limits',
      fieldsJson: {
        sub_limits: [{ procedure: 'Cataract', limit_amount: 25000, limit_type: 'per_procedure' }],
      } as Record<string, unknown>,
      rawText: 'Cataract surgery is covered up to ₹25,000.',
    })];
    const pitch = 'There are no sub-limits, everything is covered under the full sum insured!';
    const result = comparePitch(pitch, clauses);
    const subContra = result.contradictions.find(c => c.claimType === 'sub_limit');
    expect(subContra).toBeDefined();
    expect(subContra!.severity).toBe('contradiction');
    expect(subContra!.explanation).toContain('sub-limits');
  });

  test('warns when cashless claim cannot be verified', () => {
    const clauses = [makeClause({
      clauseType: 'network_clause',
      fieldsJson: {} as Record<string, unknown>,
      rawText: 'Network hospital list available on website.',
    })];
    const pitch = 'You get cashless treatment at all our network hospitals!';
    const result = comparePitch(pitch, clauses);
    const cashlessContra = result.contradictions.find(c => c.claimType === 'cashless');
    expect(cashlessContra).toBeDefined();
    expect(cashlessContra!.severity).toBe('warning');
  });

  test('detects contradiction when salesperson claims maternity coverage but policy excludes it', () => {
    const clauses = [makeClause({
      clauseType: 'exclusions',
      fieldsJson: {
        exclusions: [{ condition: 'Maternity and pregnancy related expenses', is_permanent: true }],
      } as Record<string, unknown>,
      rawText: 'Maternity expenses are permanently excluded.',
    })];
    const pitch = 'Maternity is fully covered, including delivery and newborn care!';
    const result = comparePitch(pitch, clauses);
    const matContra = result.contradictions.find(c => c.claimType === 'maternity');
    expect(matContra).toBeDefined();
    expect(matContra!.severity).toBe('contradiction');
  });

  test('returns empty result when pitch has no recognizable claims', () => {
    const clauses = [makeClause()];
    const pitch = 'This is the best policy ever, buy it today!';
    const result = comparePitch(pitch, clauses);
    expect(result.claims).toHaveLength(0);
    expect(result.contradictions).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });

  test('provides source excerpt for contradictions', () => {
    const clauses = [makeClause({
      clauseType: 'co_pay',
      fieldsJson: { co_pay: { percentage: 20 } } as Record<string, unknown>,
      rawText: 'A co-payment clause of 20% is applicable. This is the source text.',
    })];
    const pitch = 'No copay at all!';
    const result = comparePitch(pitch, clauses);
    const copayContra = result.contradictions.find(c => c.claimType === 'co_pay');
    expect(copayContra).toBeDefined();
    expect(copayContra!.sourceExcerpt).toContain('20%');
  });

  test('matches multiple claims in a single pitch', () => {
    const clauses = [
      makeClause({
        clauseType: 'co_pay',
        fieldsJson: { co_pay: { percentage: 20 } } as Record<string, unknown>,
        rawText: '20% co-pay applies.',
      }),
      makeClause({
        clauseType: 'room_rent',
        fieldsJson: { room_rent_clause: { cap_type: 'proportionate_deduction' } } as Record<string, unknown>,
        rawText: 'Room rent capped with proportionate deduction.',
      }),
    ];
    const pitch = 'No copay, no room rent cap, everything is covered!';
    const result = comparePitch(pitch, clauses);
    expect(result.contradictions.length).toBeGreaterThanOrEqual(2);
    expect(result.summary.contradictions).toBeGreaterThanOrEqual(2);
  });

  test('returns summary with correct counts', () => {
    const clauses = [makeClause({
      clauseType: 'co_pay',
      fieldsJson: { co_pay: { percentage: 10 } } as Record<string, unknown>,
      rawText: '10% co-pay.',
    })];
    const pitch = 'Zero copay!';
    const result = comparePitch(pitch, clauses);
    expect(result.summary.total).toBe(1);
    expect(result.summary.contradictions).toBe(1);
    expect(result.summary.matches).toBe(0);
  });
});