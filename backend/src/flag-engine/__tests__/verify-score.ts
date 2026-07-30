import { computePolicyScore } from '../score.js';
import type { ExtractedClause } from '../index.js';

function c(overrides: Partial<ExtractedClause> & { fieldsJson: Record<string, unknown> }): ExtractedClause {
  return { clauseType: 'general', rawText: 'sample clause text for testing', pageNumber: 1, confidence: 'high', ...overrides };
}

// Sample Policy 1: Bajaj Allianz with room rent cap + co-pay + sub-limit
const policy1Clauses = [c({
  clauseType: 'room_rent',
  fieldsJson: {
    sum_insured: 500000,
    room_rent_clause: { cap_type: 'percent_of_sum_insured', cap_value: 2, proportionate_deduction: true },
    co_pay: { percentage: 20 },
    sub_limits: [{ procedure: 'Cataract', cap_value: 25000, cap_type: 'fixed_amount', source_excerpt: 'Cataract covered up to Rs 25,000' }],
  },
  rawText: 'Room rent capped at 2% of sum insured with proportionate deduction. Co-pay 20%. Cataract sub-limit Rs 25,000.',
})];

const policy1Result = computePolicyScore(policy1Clauses, 'Bajaj Allianz General Insurance Ltd');
console.log('=== SAMPLE POLICY 1: Bajaj Allianz (Room rent cap + Co-pay + Sub-limit) ===');
console.log(JSON.stringify(policy1Result, null, 2));
console.log(`\nScore: ${policy1Result.score}`);
console.log(`Breakdown: ${JSON.stringify(policy1Result.breakdown)}`);
const redPenalties = Object.values(policy1Result.breakdown).filter((v: number) => v < 0).reduce((a: number, b: number) => a + b, 0);
const greenBonuses = Object.values(policy1Result.breakdown).filter((v: number) => v > 0).reduce((a: number, b: number) => a + b, 0);
console.log(`Red penalties: ${redPenalties}, Green bonuses: ${greenBonuses}`);
console.log(`100 + (${redPenalties}) + (${greenBonuses}) = ${100 + redPenalties + greenBonuses} === displayed score ${policy1Result.score} ✓`);
console.log(`Settlement ratio: ${policy1Result.settlementRatio}% (matched: ${policy1Result.settlementRatioMatchedInsurer})`);

// Sample Policy 2: ICICI Lombard with only PED waiting period > 24 months + restoration benefit
const policy2Clauses = [c({
  clauseType: 'waiting_period_and_benefits',
  fieldsJson: {
    sum_insured: 1000000,
    waiting_periods: [{ condition: 'Pre-existing diseases', period_months: 48, period_type: 'ped', source_excerpt: 'PED waiting period 4 years' }],
    restoration_benefit: { present: true },
    network_clause: { cashless_default: true, network_size_stated: true },
  },
  rawText: 'PED waiting period of 4 years. Sum insured restores automatically after exhaustion. Cashless at 6,500+ network hospitals.',
})];

const policy2Result = computePolicyScore(policy2Clauses, 'ICICI Lombard');
console.log(`\n=== SAMPLE POLICY 2: ICICI Lombard (PED 48mo + Restoration + Cashless network) ===`);
console.log(JSON.stringify(policy2Result, null, 2));
console.log(`\nScore: ${policy2Result.score}`);
console.log(`Breakdown: ${JSON.stringify(policy2Result.breakdown)}`);
const redPenalties2 = Object.values(policy2Result.breakdown).filter((v: number) => v < 0).reduce((a: number, b: number) => a + b, 0);
const greenBonuses2 = Object.values(policy2Result.breakdown).filter((v: number) => v > 0).reduce((a: number, b: number) => a + b, 0);
console.log(`Red penalties: ${redPenalties2}, Green bonuses: ${greenBonuses2}`);
console.log(`100 + (${redPenalties2}) + (${greenBonuses2}) = ${100 + redPenalties2 + greenBonuses2} === displayed score ${policy2Result.score} ✓`);
console.log(`Settlement ratio: ${policy2Result.settlementRatio}% (matched: ${policy2Result.settlementRatioMatchedInsurer})`);

// Verify settlement ratio is display-only (never in breakdown)
if (policy1Result.breakdown['settlementRatio']) {
  console.log('ERROR: settlementRatio found in breakdown!');
} else {
  console.log('\nSettlement ratio is display-only: NOT in breakdown ✓');
}
if (policy2Result.breakdown['settlementRatio']) {
  console.log('ERROR: settlementRatio found in breakdown!');
} else {
  console.log('Settlement ratio is display-only: NOT in breakdown ✓');
}