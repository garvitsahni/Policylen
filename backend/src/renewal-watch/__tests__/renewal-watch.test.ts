import { describe, test, expect } from 'vitest';
import { MOCK_POLICY_VERSIONS, getRenewalImpact } from '../index.js';

describe('getRenewalImpact', () => {
  test('compares two versions and returns impact data', () => {
    const [v1, v2] = MOCK_POLICY_VERSIONS;
    const impact = getRenewalImpact(v1, v2);
    expect(impact.scoreDiff).toBeDefined();
    expect(impact.premiumChange).toBeDefined();
    expect(impact.positiveChanges).toBeGreaterThanOrEqual(0);
    expect(impact.negativeChanges).toBeGreaterThanOrEqual(0);
    expect(impact.criticalFlags).toBeDefined();
  });

  test('detects negative changes in the mock data', () => {
    const [v1, v2] = MOCK_POLICY_VERSIONS;
    const impact = getRenewalImpact(v1, v2);
    expect(impact.scoreDiff).toBeLessThan(0);
    expect(impact.negativeChanges).toBeGreaterThan(0);
  });

  test('produces a summary string', () => {
    const [v1, v2] = MOCK_POLICY_VERSIONS;
    const impact = getRenewalImpact(v1, v2);
    expect(typeof impact.summary).toBe('string');
    expect(impact.summary.length).toBeGreaterThan(10);
  });

  test('correctly lists critical flags (new/worsened red)', () => {
    const [v1, v2] = MOCK_POLICY_VERSIONS;
    const impact = getRenewalImpact(v1, v2);
    expect(impact.criticalFlags.length).toBeGreaterThanOrEqual(1);
  });
});