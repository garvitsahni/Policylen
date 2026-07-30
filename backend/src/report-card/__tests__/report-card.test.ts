import { generateReportCard } from '../index.js';

const baseFlags = [
  { ruleId: 'R01', type: 'red' as const, severity: 'high', clauseType: 'room_rent', explanation: 'Room rent capped at 2% of sum insured with proportionate deduction.', excerpt: 'Room rent cap applies.' },
  { ruleId: 'R02', type: 'red' as const, severity: 'high', clauseType: 'co_pay', explanation: '20% co-payment on all admissions.', excerpt: '20% co-pay.' },
  { ruleId: 'G01', type: 'green' as const, severity: 'low', clauseType: 'restoration', explanation: 'Full restoration benefit available.', excerpt: 'Restoration applies.' },
  { ruleId: 'G02', type: 'green' as const, severity: 'low', clauseType: 'waiting_period', explanation: 'No PED waiting period.', excerpt: 'No PED wait.' },
  { ruleId: 'G04', type: 'green' as const, severity: 'low', clauseType: 'sub_limit', explanation: 'No sub-limits on procedures.', excerpt: 'No sub-limits.' },
];

describe('generateReportCard', () => {
  it('returns all required fields', () => {
    const card = generateReportCard({
      score: 60,
      flags: baseFlags,
      settlementRatio: 85,
      settlementRatioMatchedInsurer: 'ABC Insurance',
      breakdown: { room_rent: -20, co_pay: -20, ped_waiting: 0, sub_limits: 0, restoration: 0 },
    }, { insurerName: 'ABC Insurance', sumInsured: 500000, premium: 12000 });
    expect(card.reportGeneratedAt).toBeDefined();
    expect(card.policyInfo.insurerName).toBe('ABC Insurance');
    expect(card.policyInfo.sumInsured).toBe(500000);
    expect(card.score).toBe(60);
    expect(card.flags.length).toBe(5);
    expect(card.stamps.length).toBeGreaterThan(0);
    expect(card.topFlags.length).toBe(3);
  });

  it('places red flags before green in top flags', () => {
    const card = generateReportCard({
      score: 60,
      flags: baseFlags,
      settlementRatio: 85,
      settlementRatioMatchedInsurer: null,
      breakdown: {},
    }, {});
    expect(card.topFlags[0].type).toBe('red');
    expect(card.topFlags[1].type).toBe('red');
    expect(card.topFlags[2].type).toBe('green');
  });

  it('adds RECOMMENDED stamp for score >= 70', () => {
    const card = generateReportCard({
      score: 75,
      flags: [],
      settlementRatio: null,
      settlementRatioMatchedInsurer: null,
      breakdown: {},
    }, {});
    expect(card.stamps).toContain('RECOMMENDED');
  });

  it('adds HIGH_RISK stamp for score < 40', () => {
    const card = generateReportCard({
      score: 20,
      flags: baseFlags,
      settlementRatio: null,
      settlementRatioMatchedInsurer: null,
      breakdown: {},
    }, {});
    expect(card.stamps).toContain('HIGH_RISK');
  });

  it('adds READ_WITH_CAUTION stamp for scores 40-69', () => {
    const card = generateReportCard({
      score: 55,
      flags: baseFlags,
      settlementRatio: null,
      settlementRatioMatchedInsurer: null,
      breakdown: {},
    }, {});
    expect(card.stamps).toContain('READ_WITH_CAUTION');
  });

  it('adds CONSUMER_FRIENDLY stamp for 3+ green flags', () => {
    const card = generateReportCard({
      score: 60,
      flags: baseFlags,
      settlementRatio: null,
      settlementRatioMatchedInsurer: null,
      breakdown: {},
    }, {});
    expect(card.stamps).toContain('CONSUMER_FRIENDLY');
  });

  it('adds HAS_RESTORATION stamp when R13 is present', () => {
    const flags = [...baseFlags, { ruleId: 'R13', type: 'green' as const, severity: 'low', clauseType: 'restoration', explanation: 'Restoration', excerpt: 'Restoration' }];
    const card = generateReportCard({
      score: 60,
      flags,
      settlementRatio: null,
      settlementRatioMatchedInsurer: null,
      breakdown: {},
    }, {});
    expect(card.stamps).toContain('HAS_RESTORATION');
  });

  it('adds STRONG_SETTLEMENT_RATIO stamp when ratio >= 80', () => {
    const card = generateReportCard({
      score: 60,
      flags: [],
      settlementRatio: 85,
      settlementRatioMatchedInsurer: null,
      breakdown: {},
    }, {});
    expect(card.stamps).toContain('STRONG_SETTLEMENT_RATIO');
  });

  it('adds LOW_SETTLEMENT_RATIO stamp when ratio < 50', () => {
    const card = generateReportCard({
      score: 60,
      flags: [],
      settlementRatio: 40,
      settlementRatioMatchedInsurer: null,
      breakdown: {},
    }, {});
    expect(card.stamps).toContain('LOW_SETTLEMENT_RATIO');
  });

  it('truncates long explanations in topFlags', () => {
    const longFlags = [{
      ruleId: 'R99', type: 'red' as const, severity: 'high', clauseType: 'test',
      explanation: 'A'.repeat(200),
      excerpt: 'Excerpt here.',
    }];
    const card = generateReportCard({
      score: 50,
      flags: longFlags,
      settlementRatio: null,
      settlementRatioMatchedInsurer: null,
      breakdown: {},
    }, {});
    expect(card.topFlags[0].simplifiedExplanation.length).toBeLessThanOrEqual(120);
  });
});