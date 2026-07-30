export interface MockPolicyVersion {
  version: string
  year: string
  sumInsured: number
  premium: number
  flags: { ruleId: string; type: string; changed: 'new' | 'removed' | 'worsened' | 'improved' | 'unchanged'; description: string }[]
  score: number
  changes: { field: string; before: string; after: string; impact: 'positive' | 'negative' | 'neutral' }[]
}

const BASE_V1_FLAGS = [
  { ruleId: 'R02', type: 'red', changed: 'unchanged' as const, description: '20% co-payment on all admissions' },
  { ruleId: 'R03', type: 'red', changed: 'new' as const, description: '48-month PED waiting period' },
  { ruleId: 'R01', type: 'red', changed: 'unchanged' as const, description: 'Room rent capped at 2% SI with proportionate deduction' },
  { ruleId: 'R06', type: 'red', changed: 'unchanged' as const, description: '₹25,000 sub-limit on cataract surgery' },
  { ruleId: 'R12', type: 'red', changed: 'unchanged' as const, description: 'Permanent exclusion of maternity expenses' },
  { ruleId: 'G01', type: 'green', changed: 'unchanged' as const, description: 'Restoration benefit available' },
]

export const MOCK_POLICY_VERSIONS: MockPolicyVersion[] = [
  {
    version: 'v1',
    year: 'Year 1 (2024-25)',
    sumInsured: 300000,
    premium: 8500,
    flags: BASE_V1_FLAGS,
    score: 40,
    changes: [],
  },
  {
    version: 'v2',
    year: 'Year 2 (2025-26) — Renewed',
    sumInsured: 500000,
    premium: 10500,
    flags: [
      { ruleId: 'R02', type: 'red', changed: 'worsened' as const, description: '25% co-payment on all admissions (was 20%)' },
      { ruleId: 'R07', type: 'red', changed: 'new' as const, description: 'No-claim bonus reduced from 50% to 25%' },
      { ruleId: 'R01', type: 'red', changed: 'unchanged' as const, description: 'Room rent capped at 2% SI with proportionate deduction' },
      { ruleId: 'R06', type: 'red', changed: 'improved' as const, description: 'Sub-limit on cataract raised to ₹35,000 (was ₹25,000)' },
      { ruleId: 'R12', type: 'red', changed: 'unchanged' as const, description: 'Permanent exclusion of maternity expenses' },
      { ruleId: 'G01', type: 'green', changed: 'unchanged' as const, description: 'Restoration benefit available' },
      { ruleId: 'G05', type: 'green', changed: 'new' as const, description: 'Day-care procedures added (new benefit)' },
    ],
    score: 35,
    changes: [
      { field: 'Sum Insured', before: '₹3,00,000', after: '₹5,00,000', impact: 'positive' as const },
      { field: 'Premium', before: '₹8,500/yr', after: '₹10,500/yr', impact: 'negative' as const },
      { field: 'Co-pay %', before: '20%', after: '25%', impact: 'negative' as const },
      { field: 'No-claim Bonus', before: '50%', after: '25%', impact: 'negative' as const },
      { field: 'Cataract Sub-limit', before: '₹25,000', after: '₹35,000', impact: 'positive' as const },
      { field: 'Day-care Coverage', before: 'Not covered', after: 'Covered (new)', impact: 'positive' as const },
    ],
  },
]

export function getRenewalImpact(v1: MockPolicyVersion, v2: MockPolicyVersion): {
  summary: string
  scoreDiff: number
  premiumChange: number
  positiveChanges: number
  negativeChanges: number
  criticalFlags: string[]
} {
  const scoreDiff = v2.score - v1.score
  const premiumChange = v2.premium - v1.premium
  const positiveChanges = v2.changes.filter(c => c.impact === 'positive').length
  const negativeChanges = v2.changes.filter(c => c.impact === 'negative').length
  const criticalFlags = v2.flags
    .filter(f => (f.changed === 'new' || f.changed === 'worsened') && f.type === 'red')
    .map(f => f.description)

  let summary: string
  if (scoreDiff > 0 && criticalFlags.length === 0) {
    summary = 'Your policy has improved at renewal. Check the new benefits carefully.'
  } else if (scoreDiff >= 0 && positiveChanges >= negativeChanges) {
    summary = `Mixed changes at renewal. Score stayed same but ${positiveChanges} improvements and ${negativeChanges} setbacks were found. Review the details below.`
  } else if (negativeChanges > positiveChanges) {
    summary = `Your policy got worse at renewal. ${negativeChanges} terms changed for the worse including ${criticalFlags.join(', ')}. Consider shopping around before the next renewal.`
  } else {
    summary = 'Review the renewal terms carefully. Several policy conditions have changed since last year.'
  }

  return { summary, scoreDiff, premiumChange, positiveChanges, negativeChanges, criticalFlags }
}