import { describe, test, expect } from 'vitest';
import { simulateAllScenarios, simulateScenario, SCENARIO_METADATA } from '../../scenario-simulator/index.js';
import { matchFlags } from '../../flag-engine/index.js';
import type { ExtractedClause } from '../../flag-engine/index.js';

function c(overrides: Partial<ExtractedClause> & { fieldsJson: Record<string, unknown> }): ExtractedClause {
  return { clauseType: 'general', rawText: 'test clause', pageNumber: 1, confidence: 'high', ...overrides };
}

describe('Scenario Simulator — narrative output', () => {
  const testClauses = [c({
    clauseType: 'general',
    fieldsJson: {
      sum_insured: 500000,
      room_rent_clause: { cap_type: 'percent_of_sum_insured', cap_value: 2, proportionate_deduction: true },
      co_pay: { percentage: 20 },
      sub_limits: [{ procedure: 'Cataract surgery', cap_value: 25000, cap_type: 'fixed_amount' }],
      waiting_periods: [
        { condition: 'Pre-existing diseases', period_months: 48, period_type: 'ped' },
        { condition: 'Cataract', period_months: 24, period_type: 'specific_disease' },
      ],
      exclusions: [{ condition: 'Congenital external disease', is_permanent: true }],
    },
  })];

  const { flags } = matchFlags(testClauses);

  test('all 5 scenarios exist with metadata', () => {
    const ids = Object.keys(SCENARIO_METADATA);
    expect(ids).toHaveLength(5);
    expect(ids).toContain('hospitalization');
    expect(ids).toContain('named-surgery');
    expect(ids).toContain('ped-claim');
    expect(ids).toContain('maternity');
    expect(ids).toContain('accident');
  });

  test('hospitalization produces narrative with rupee figures', () => {
    const result = simulateScenario('hospitalization', testClauses, flags);
    expect(result).not.toBeNull();
    expect(result!.scenarioId).toBe('hospitalization');
    expect(result!.narrative).toBeTruthy();
    expect(result!.narrative).toContain('₹');
    expect(result!.estimatedTotalCost).toBeGreaterThan(0);
    expect(result!.lineItems.length).toBeGreaterThanOrEqual(2);
    expect(result!.summary).toContain('Covered');
    expect(result!.summary).toContain('pay');
  });

  test('hospitalization with room rent cap + co-pay shows realistic out-of-pocket', () => {
    const result = simulateScenario('hospitalization', testClauses, flags);
    expect(result).not.toBeNull();
    // Room rent capped at 2% of 500000 = 10000. Room rent cost = 50000. Gap 40000.
    // Treatment sub-limit for "hospitalization" not found, so fully covered 200000.
    // Co-pay 20% on covered amount (200000 + 10000 room cap = 210000 * 20% = 42000)
    expect(result!.estimatedOutOfPocket).toBeGreaterThan(40000);
    expect(result!.relevantFlags.length).toBeGreaterThanOrEqual(1);
  });

  test('named surgery shows waiting period impact for cataract', () => {
    const result = simulateScenario('named-surgery', testClauses, flags);
    expect(result).not.toBeNull();
    // Cataract has 24-month waiting period
    expect(result!.narrative.toLowerCase()).toContain('waiting period');
    expect(result!.estimatedOutOfPocket).toBe(result!.estimatedTotalCost); // Full cost out of pocket
  });

  test('PED claim shows rejection for long waiting period', () => {
    const result = simulateScenario('ped-claim', testClauses, flags);
    expect(result).not.toBeNull();
    expect(result!.estimatedCovered).toBe(0); // Nothing covered during PED waiting period
    expect(result!.narrative.toLowerCase()).toContain('rejected');
  });

  test('maternity shows coverage status', () => {
    const result = simulateScenario('maternity', testClauses, flags);
    expect(result).not.toBeNull();
    expect(result!.estimatedTotalCost).toBe(115000);
    expect(result!.scenarioId).toBe('maternity');
  });

  test('accident is covered from day 1', () => {
    const result = simulateScenario('accident', testClauses, flags);
    expect(result).not.toBeNull();
    expect(result!.estimatedCovered).toBeGreaterThan(0);
    expect(result!.narrative.toLowerCase()).toContain('day 1');
  });

  test('unknown scenario returns null', () => {
    const result = simulateScenario('nonexistent', testClauses, flags);
    expect(result).toBeNull();
  });

  test('simulateAll returns 5 results', () => {
    const results = simulateAllScenarios(testClauses, flags);
    expect(results).toHaveLength(5);
    for (const r of results) {
      expect(r.narrative).toBeTruthy();
      expect(r.summary).toBeTruthy();
      expect(r.lineItems.length).toBeGreaterThan(0);
    }
  });
});

describe('Scenario Simulator — edge cases', () => {
  test('no co-pay shows no co-pay line item in hospitalization', () => {
    const clauses = [c({
      fieldsJson: { sum_insured: 500000, room_rent_clause: { cap_type: 'no_cap' } },
    })];
    const { flags } = matchFlags(clauses);
    const result = simulateScenario('hospitalization', clauses, flags);
    expect(result).not.toBeNull();
    const coPayItems = result!.lineItems.filter(li => li.label.includes('Co-pay'));
    expect(coPayItems.length).toBe(0);
  });

  test('excluded procedure in named surgery', () => {
    const clauses = [c({
      fieldsJson: {
        sum_insured: 500000,
        exclusions: [{ condition: 'Cataract surgery', is_permanent: true }],
      },
    })];
    const { flags } = matchFlags(clauses);
    const result = simulateScenario('named-surgery', clauses, flags);
    expect(result).not.toBeNull();
    expect(result!.estimatedCovered).toBe(0);
    expect(result!.narrative.toLowerCase()).toContain('excluded');
  });

  test('short PED waiting period covers the claim', () => {
    const clauses = [c({
      fieldsJson: {
        sum_insured: 500000,
        waiting_periods: [{ condition: 'Pre-existing diseases', period_months: 12, period_type: 'ped' }],
        ped_waiting_period_months: 12,
      },
    })];
    const { flags } = matchFlags(clauses);
    const result = simulateScenario('ped-claim', clauses, flags);
    expect(result).not.toBeNull();
    expect(result!.estimatedCovered).toBeGreaterThan(0);
    expect(result!.narrative.toLowerCase()).toContain('eligible');
  });
});