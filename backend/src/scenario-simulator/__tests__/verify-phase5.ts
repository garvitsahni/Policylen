import { matchFlags } from '../../flag-engine/index.js';
import { simulateAllScenarios } from '../../scenario-simulator/index.js';
import type { ExtractedClause } from '../../flag-engine/index.js';

function c(overrides: Partial<ExtractedClause> & { fieldsJson: Record<string, unknown> }): ExtractedClause {
  return { clauseType: 'general', rawText: 'test clause', pageNumber: 1, confidence: 'high', ...overrides };
}

// Policy A: Has room rent cap + co-pay + cataract sub-limit + PED wait
const policyA = [c({
  clauseType: 'sub_limit',
  fieldsJson: {
    sum_insured: 500000,
    insurer_name: 'Policy A Insurance',
    room_rent_clause: { cap_type: 'percent_of_sum_insured', cap_value: 2, proportionate_deduction: true },
    co_pay: { percentage: 20 },
    sub_limits: [{ procedure: 'Cataract surgery', cap_value: 25000, cap_type: 'fixed_amount' }],
    waiting_periods: [
      { condition: 'Pre-existing diseases', period_months: 48, period_type: 'ped' },
      { condition: 'Cataract', period_months: 24, period_type: 'specific_disease' },
    ],
    exclusions: [{ condition: 'Congenital external disease', is_permanent: true }],
    restoration_benefit: { present: false },
  },
  rawText: 'Room rent capped at 2% of SI with proportionate deduction. Co-pay 20%. Cataract sub-limit 25k. PED wait 48 months.',
})];

// Policy B: No room rent cap, no co-pay, restoration benefit present
const policyB = [c({
  clauseType: 'benefits',
  fieldsJson: {
    sum_insured: 500000,
    insurer_name: 'Policy B Insurance',
    room_rent_clause: { cap_type: 'no_cap' },
    co_pay: { percentage: 0, explicitly_absent: true },
    sub_limits: [],
    waiting_periods: [
      { condition: 'Pre-existing diseases', period_months: 24, period_type: 'ped' },
    ],
    exclusions: [],
    restoration_benefit: { present: true },
    cumulative_bonus: { present: true },
    network_clause: { cashless_default: true, network_size_stated: true },
  },
  rawText: 'No room rent cap. No co-pay. PED wait 24 months. Restoration benefit. Cumulative bonus. Cashless network.',
})];

const { flags: flagsA, score: scoreA } = matchFlags(policyA);
const { flags: flagsB, score: scoreB } = matchFlags(policyB);

const scenariosA = simulateAllScenarios(policyA, flagsA);
const scenariosB = simulateAllScenarios(policyB, flagsB);

console.log('=' .repeat(72));
console.log('PHASE 5 VERIFICATION — SCENARIO SIMULATOR + COMPARISON');
console.log('=' .repeat(72));

console.log('\n--- POLICY A: With restrictive clauses ---');
console.log(`Score: ${scoreA.score} | Breakdown: ${JSON.stringify(scoreA.breakdown)}`);
console.log(`Flags triggered: ${flagsA.map(f => f.taxonomyId).join(', ') || 'none'}`);

for (const s of scenariosA) {
  console.log(`\n  [${s.scenarioId}] ${s.scenarioName}`);
  console.log(`    ${s.summary}`);
  console.log(`    Narrative: ${s.narrative.slice(0, 120)}...`);
  console.log(`    Line items: ${s.lineItems.length}`);
  if (s.relevantFlags.length > 0) {
    console.log(`    Affected flags: ${s.relevantFlags.map(f => f.taxonomyId).join(', ')}`);
  }
}

console.log('\n--- POLICY B: With favorable clauses ---');
console.log(`Score: ${scoreB.score} | Breakdown: ${JSON.stringify(scoreB.breakdown)}`);
console.log(`Flags triggered: ${flagsB.map(f => f.taxonomyId).join(', ') || 'none'}`);

for (const s of scenariosB) {
  console.log(`\n  [${s.scenarioId}] ${s.scenarioName}`);
  console.log(`    ${s.summary}`);
  console.log(`    Narrative: ${s.narrative.slice(0, 120)}...`);
  console.log(`    Line items: ${s.lineItems.length}`);
}

// Materially different flags between A and B
console.log('\n--- MATERIALLY DIFFERENT FLAGS (A vs B) ---');
const allIds = [...new Set([...flagsA.map(f => f.taxonomyId), ...flagsB.map(f => f.taxonomyId)])];
for (const id of allIds) {
  const inA = flagsA.find(f => f.taxonomyId === id);
  const inB = flagsB.find(f => f.taxonomyId === id);
  if ((inA && !inB) || (!inA && inB)) {
    console.log(`  ${id}: ${inA ? 'Policy A' : 'Policy B'} only`);
  } else if (inA && inB) {
    console.log(`  ${id}: Both (identical) — de-emphasized`);
  }
}

console.log('\n--- COMPARISON SUMMARY ---');
console.log(`Policy A: score ${scoreA.score}, ${flagsA.length} flags`);
console.log(`Policy B: score ${scoreB.score}, ${flagsB.length} flags`);
console.log(`Materially differing: ${allIds.filter(id => {
  const inA = flagsA.find(f => f.taxonomyId === id);
  const inB = flagsB.find(f => f.taxonomyId === id);
  return (inA && !inB) || (!inA && inB);
}).length} flags`);
console.log('=' .repeat(72));
console.log('VERIFICATION COMPLETE');
console.log('=' .repeat(72));