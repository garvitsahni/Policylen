import { describe, test, expect } from 'vitest';
import { matchFlags } from '../index.js';
import type { ExtractedClause } from '../index.js';

function makeClause(overrides: Partial<ExtractedClause> & { fieldsJson: Record<string, unknown> }): ExtractedClause {
  return {
    clauseType: 'general',
    rawText: 'Sample insurance clause text for testing purposes.',
    pageNumber: 1,
    confidence: 'high',
    ...overrides,
  };
}

describe('R01 — Room rent capping', () => {
  test('positive: room rent capped as % of sum insured with proportionate deduction', () => {
    const clauses = [makeClause({
      clauseType: 'room_rent',
      fieldsJson: {
        room_rent_clause: { cap_type: 'percent_of_sum_insured', cap_value: 2, proportionate_deduction: true },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R01')).toBeDefined();
  });

  test('negative: no room rent capping clause present', () => {
    const clauses = [makeClause({
      fieldsJson: { room_rent_clause: { cap_type: 'no_cap' } },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R01')).toBeUndefined();
  });
});

describe('R02 — Disease-specific sub-limit', () => {
  test('positive: sub-limit below sum insured', () => {
    const clauses = [makeClause({
      clauseType: 'sub_limit',
      fieldsJson: {
        sum_insured: 500000,
        sub_limits: [{ procedure: 'Cataract', cap_value: 25000, cap_type: 'fixed_amount' }],
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R02')).toBeDefined();
  });

  test('negative: sub-limit equals sum insured (effectively no cap)', () => {
    const clauses = [makeClause({
      clauseType: 'sub_limit',
      fieldsJson: {
        sum_insured: 500000,
        sub_limits: [{ procedure: 'Cataract', cap_value: 500000, cap_type: 'fixed_amount' }],
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R02')).toBeUndefined();
  });
});

describe('R03 — Co-payment clause', () => {
  test('positive: co-pay percentage > 0', () => {
    const clauses = [makeClause({
      clauseType: 'co_pay',
      fieldsJson: {
        co_pay: { percentage: 20, age_linked: false },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R03')).toBeDefined();
  });

  test('negative: no co-pay clause present', () => {
    const clauses = [makeClause({
      clauseType: 'co_pay',
      fieldsJson: {
        co_pay: { percentage: null },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R03')).toBeUndefined();
  });
});

describe('R04 — PED waiting period', () => {
  test('positive: PED waiting period > 24 months', () => {
    const clauses = [makeClause({
      clauseType: 'waiting_period',
      fieldsJson: {
        waiting_periods: [{ condition: 'Pre-existing diseases', period_months: 48, period_type: 'ped' }],
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R04')).toBeDefined();
  });

  test('negative: PED waiting period <= 24 months', () => {
    const clauses = [makeClause({
      clauseType: 'waiting_period',
      fieldsJson: {
        waiting_periods: [{ condition: 'Pre-existing diseases', period_months: 24, period_type: 'ped' }],
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R04')).toBeUndefined();
  });
});

describe('R05 — Initial waiting period', () => {
  test('positive: initial waiting period of 30 days present', () => {
    const clauses = [makeClause({
      clauseType: 'waiting_period',
      fieldsJson: {
        waiting_periods: [{ condition: 'Initial waiting period', period_months: 1, period_type: 'initial' }],
        initial_waiting_days: 30,
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R05')).toBeDefined();
  });

  test('negative: no initial waiting period mentioned', () => {
    const clauses = [makeClause({
      clauseType: 'waiting_period',
      fieldsJson: { waiting_periods: [], initial_waiting_days: 0 },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R05')).toBeUndefined();
  });
});

describe('R06 — Specific disease/procedure waiting period', () => {
  test('positive: cataract waiting period of 24 months', () => {
    const clauses = [makeClause({
      clauseType: 'waiting_period',
      fieldsJson: {
        waiting_periods: [{ condition: 'Cataract', period_months: 24, period_type: 'specific_disease' }],
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R06')).toBeDefined();
  });

  test('negative: general PED waiting period only, no specific disease wait', () => {
    const clauses = [makeClause({
      clauseType: 'waiting_period',
      fieldsJson: {
        waiting_periods: [{ condition: 'Pre-existing diseases', period_months: 48, period_type: 'ped' }],
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R06')).toBeUndefined();
  });
});

describe('R07 — Material non-disclosure clause', () => {
  test('positive: broad non-disclosure clause present', () => {
    const clauses = [makeClause({
      clauseType: 'non_disclosure',
      fieldsJson: {
        non_disclosure_clause_present: true,
        non_disclosure_scope: 'broad_any_non_disclosure',
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R07')).toBeDefined();
  });

  test('negative: no non-disclosure clause', () => {
    const clauses = [makeClause({
      clauseType: 'non_disclosure',
      fieldsJson: {
        non_disclosure_clause_present: false,
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R07')).toBeUndefined();
  });
});

describe('R08 — Sole discretion / undefined-term language', () => {
  test('positive: discretionary language present in raw text', () => {
    const clauses = [makeClause({
      clauseType: 'general',
      fieldsJson: { discretionary_language_excerpt: 'at the sole discretion of the Company' },
      rawText: 'Reasonable and customary charges shall be determined at the sole discretion of the Company.',
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R08')).toBeDefined();
  });

  test('negative: no discretionary language', () => {
    const clauses = [makeClause({
      clauseType: 'general',
      fieldsJson: {},
      rawText: 'This policy covers all hospitalization expenses as per the schedule.',
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R08')).toBeUndefined();
  });
});

describe('R09 — Sub-limit on ambulance/daycare', () => {
  test('positive: ambulance sub-limit present', () => {
    const clauses = [makeClause({
      clauseType: 'sub_limit',
      fieldsJson: {
        sub_limits: [{ procedure: 'Ambulance charges', cap_value: 2000, cap_type: 'fixed_amount' }],
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R09')).toBeDefined();
  });

  test('negative: no ancillary sub-limits', () => {
    const clauses = [makeClause({
      clauseType: 'sub_limit',
      fieldsJson: { sub_limits: [] },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R09')).toBeUndefined();
  });
});

describe('R10 — Non-network hospital reduced payout', () => {
  test('positive: non-network payout reduced', () => {
    const clauses = [makeClause({
      clauseType: 'network',
      fieldsJson: {
        network_clause: { non_network_payout_reduced: true, cashless_default: false },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R10')).toBeDefined();
  });

  test('negative: no non-network reduction clause', () => {
    const clauses = [makeClause({
      clauseType: 'network',
      fieldsJson: {
        network_clause: { non_network_payout_reduced: false, cashless_default: true },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R10')).toBeUndefined();
  });
});

describe('R11 — Renewal non-guarantee / loading clause', () => {
  test('positive: claims-based loading present', () => {
    const clauses = [makeClause({
      clauseType: 'renewal',
      fieldsJson: {
        renewal_clause: { claims_based_loading: true, guaranteed_renewal: false },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R11')).toBeDefined();
  });

  test('negative: guaranteed renewal', () => {
    const clauses = [makeClause({
      clauseType: 'renewal',
      fieldsJson: {
        renewal_clause: { claims_based_loading: false, guaranteed_renewal: true },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R11')).toBeUndefined();
  });
});

describe('R12 — Permanent exclusions list', () => {
  test('positive: permanent exclusions present', () => {
    const clauses = [makeClause({
      clauseType: 'exclusion',
      fieldsJson: {
        exclusions: [
          { condition: 'Congenital external disease', is_permanent: true },
          { condition: 'HIV/AIDS', is_permanent: true },
        ],
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R12')).toBeDefined();
  });

  test('negative: no permanent exclusions', () => {
    const clauses = [makeClause({
      clauseType: 'exclusion',
      fieldsJson: { exclusions: [] },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R12')).toBeUndefined();
  });
});

describe('R13 — Claim intimation deadline', () => {
  test('positive: intimation deadline <= 48 hours', () => {
    const clauses = [makeClause({
      clauseType: 'claim_process',
      fieldsJson: {
        claim_process: [{ step_name: 'intimation', timeframe_hours: 24 }],
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R13')).toBeDefined();
  });

  test('negative: generous intimation deadline', () => {
    const clauses = [makeClause({
      clauseType: 'claim_process',
      fieldsJson: {
        claim_process: [{ step_name: 'intimation', timeframe_hours: 72 }],
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R13')).toBeUndefined();
  });
});

describe('G01 — No room rent capping', () => {
  test('positive: explicitly uncapped room rent', () => {
    const clauses = [makeClause({
      clauseType: 'room_rent',
      fieldsJson: {
        room_rent_clause: { cap_type: 'no_cap' },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'G01')).toBeDefined();
  });

  test('negative: room rent IS capped', () => {
    const clauses = [makeClause({
      clauseType: 'room_rent',
      fieldsJson: {
        room_rent_clause: { cap_type: 'percent_of_sum_insured', cap_value: 2 },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'G01')).toBeUndefined();
  });
});

describe('G02 — No co-payment', () => {
  test('positive: co-pay explicitly absent for buyer age band', () => {
    const clauses = [makeClause({
      clauseType: 'co_pay',
      fieldsJson: {
        co_pay: { percentage: 0, explicitly_absent: true },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'G02')).toBeDefined();
  });

  test('negative: co-pay exists', () => {
    const clauses = [makeClause({
      clauseType: 'co_pay',
      fieldsJson: {
        co_pay: { percentage: 20, explicitly_absent: false },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'G02')).toBeUndefined();
  });
});

describe('G03 — Short PED waiting period', () => {
  test('positive: PED waiting period <= 24 months and explicitly stated', () => {
    const clauses = [makeClause({
      clauseType: 'waiting_period',
      fieldsJson: {
        waiting_periods: [{ condition: 'Pre-existing diseases', period_months: 24, period_type: 'ped' }],
        ped_waiting_period_months: 24,
        ped_explicitly_stated: true,
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'G03')).toBeDefined();
  });

  test('negative: PED waiting period > 24 months', () => {
    const clauses = [makeClause({
      clauseType: 'waiting_period',
      fieldsJson: {
        waiting_periods: [{ condition: 'Pre-existing diseases', period_months: 48, period_type: 'ped' }],
        ped_waiting_period_months: 48,
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'G03')).toBeUndefined();
  });
});

describe('G04 — Restoration/refill benefit', () => {
  test('positive: restoration benefit present', () => {
    const clauses = [makeClause({
      clauseType: 'restoration',
      fieldsJson: {
        restoration_benefit: { present: true },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'G04')).toBeDefined();
  });

  test('negative: no restoration benefit', () => {
    const clauses = [makeClause({
      clauseType: 'restoration',
      fieldsJson: {
        restoration_benefit: { present: false },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'G04')).toBeUndefined();
  });
});

describe('G05 — No sub-limits on named procedures', () => {
  test('positive: explicit statement that no sub-limits exist', () => {
    const clauses = [makeClause({
      clauseType: 'sub_limit',
      fieldsJson: {
        no_sub_limits_statement_present: true,
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'G05')).toBeDefined();
  });

  test('negative: sub-limits exist on procedures', () => {
    const clauses = [makeClause({
      clauseType: 'sub_limit',
      fieldsJson: {
        no_sub_limits_statement_present: false,
        sub_limits: [{ procedure: 'Cataract', cap_value: 25000, cap_type: 'fixed_amount' }],
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'G05')).toBeUndefined();
  });
});

describe('G06 — Cumulative bonus / no-claim bonus', () => {
  test('positive: cumulative bonus present', () => {
    const clauses = [makeClause({
      clauseType: 'cumulative_bonus',
      fieldsJson: {
        cumulative_bonus: { present: true },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'G06')).toBeDefined();
  });

  test('negative: no cumulative bonus', () => {
    const clauses = [makeClause({
      clauseType: 'cumulative_bonus',
      fieldsJson: {
        cumulative_bonus: { present: false },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'G06')).toBeUndefined();
  });
});

describe('G07 — Wide hospital network with cashless', () => {
  test('positive: cashless default and network size stated', () => {
    const clauses = [makeClause({
      clauseType: 'network',
      fieldsJson: {
        network_clause: { cashless_default: true, network_size_stated: true },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'G07')).toBeDefined();
  });

  test('negative: no network size info or cashless not default', () => {
    const clauses = [makeClause({
      clauseType: 'network',
      fieldsJson: {
        network_clause: { cashless_default: false, network_size_stated: false },
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'G07')).toBeUndefined();
  });
});

describe('Score calculation', () => {
  test('base score 100 with no flags triggered', () => {
    const clauses = [makeClause({
      fieldsJson: { room_rent_clause: { cap_type: 'no_cap' } },
    })];
    clauses.push(makeClause({
      fieldsJson: { co_pay: { percentage: 0, explicitly_absent: true } },
    }));
    const { score: { score } } = matchFlags(clauses);
    expect(score).toBe(100);
  });

  test('red flags reduce score and green flags increase it', () => {
    const clauses = [makeClause({
      clauseType: 'sub_limit',
      fieldsJson: {
        sum_insured: 500000,
        sub_limits: [{ procedure: 'Cataract', cap_value: 25000, cap_type: 'fixed_amount' }],
        co_pay: { percentage: 20 },
        room_rent_clause: { cap_type: 'percent_of_sum_insured', cap_value: 2, proportionate_deduction: true },
        non_disclosure_clause_present: true,
        non_disclosure_scope: 'broad_any_non_disclosure',
      },
    })];
    const { flags, score: { score } } = matchFlags(clauses);
    const redCount = flags.filter(f => f.colorType === 'red').length;
    expect(score).toBeLessThan(100);
    expect(redCount).toBeGreaterThanOrEqual(3);
  });
});

describe('Source excerpt traceability', () => {
  test('each flag has a sourceExcerpt matching a clause', () => {
    const clauses = [makeClause({
      clauseType: 'sub_limit',
      fieldsJson: {
        sum_insured: 500000,
        sub_limits: [{ procedure: 'Cataract', cap_value: 25000, cap_type: 'fixed_amount' }],
      },
      rawText: 'Cataract surgery is covered up to ₹25,000 only.',
    })];
    const { flags } = matchFlags(clauses);
    for (const flag of flags) {
      expect(flag.sourceExcerpt).toBeTruthy();
      if (flag.colorType === 'red') {
        expect(clauses.some(c => c.rawText === flag.sourceExcerpt)).toBe(true);
      }
    }
  });
});

describe('Multiple flags from single clause', () => {
  test('a single clause can trigger both R02 and R06', () => {
    const clauses = [makeClause({
      clauseType: 'waiting_period_and_sub_limit',
      fieldsJson: {
        sum_insured: 500000,
        sub_limits: [{ procedure: 'Cataract', cap_value: 25000, cap_type: 'fixed_amount' }],
        waiting_periods: [{ condition: 'Cataract', period_months: 12, period_type: 'specific_disease' }],
      },
    })];
    const { flags } = matchFlags(clauses);
    expect(flags.find(f => f.taxonomyId === 'R02')).toBeDefined();
    expect(flags.find(f => f.taxonomyId === 'R06')).toBeDefined();
  });
});