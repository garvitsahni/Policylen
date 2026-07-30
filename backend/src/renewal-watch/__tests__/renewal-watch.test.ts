import { MOCK_POLICY_VERSIONS, getRenewalImpact } from '../index.js';

describe('getRenewalImpact', () => {
  it('compares two versions and returns impact data', () => {
    const [v1, v2] = MOCK_POLICY_VERSIONS;
    const impact = getRenewalImpact(v1, v2);
    expect(impact.scoreDiff).toBeDefined();
    expect(impact.premiumChange).toBeDefined();
    expect(impact.positiveChanges).toBeGreaterThanOrEqual(0);
    expect(impact.negativeChanges).toBeGreaterThanOrEqual(0);
    expect(impact.criticalFlags).toBeDefined();
  });

  it('detects negative changes in the mock data', () => {
    const [v1, v2] = MOCK_POLICY_VERSIONS;
    const impact = getRenewalImpact(v1, v2);
    expect(impact.scoreDiff).toBeLessThan(0);
    expect(impact.negativeChanges).toBeGreaterThan(0);
  });

  it('produces a summary string', () => {
    const [v1, v2] = MOCK_POLICY_VERSIONS;
    const impact = getRenewalImpact(v1, v2);
    expect(typeof impact.summary).toBe('string');
    expect(impact.summary.length).toBeGreaterThan(10);
  });

  it('correctly lists critical flags (new/worsened red)', () => {
    const [v1, v2] = MOCK_POLICY_VERSIONS;
    const impact = getRenewalImpact(v1, v2);
    expect(impact.criticalFlags.length).toBeGreaterThanOrEqual(1);
  });
});