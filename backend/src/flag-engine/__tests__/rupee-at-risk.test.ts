import { describe, test, expect } from 'vitest';
import { calculateRupeeAtRisk } from '../rupee-at-risk.js';

describe('Rupee-at-risk calculator', () => {
  test('sub-limit shortfall with sum insured and claim amount stated', () => {
    const result = calculateRupeeAtRisk({
      sumInsured: 500000,
      claimAmount: 200000,
      subLimitCap: 25000,
    });
    expect(result.amount).toBe(175000);
    expect(result.components.subLimitShortfall).toBe(175000);
    expect(result.missingFields).toEqual([]);
  });

  test('co-pay out-of-pocket calculated correctly', () => {
    const result = calculateRupeeAtRisk({
      claimAmount: 200000,
      coPayPct: 20,
    });
    expect(result.amount).toBe(40000);
    expect(result.components.coPayOutOfPocket).toBe(40000);
  });

  test('returns null when sumInsured missing but sub-limit present', () => {
    const result = calculateRupeeAtRisk({
      claimAmount: 200000,
      subLimitCap: 25000,
    });
    expect(result.amount).toBeNull();
    expect(result.missingFields).toContain('sum_insured');
  });

  test('returns null when claim amount missing entirely', () => {
    const result = calculateRupeeAtRisk({
      coPayPct: 20,
    });
    expect(result.amount).toBeNull();
    expect(result.missingFields).toContain('claim_amount');
  });

  test('room rent proportion cut', () => {
    const result = calculateRupeeAtRisk({
      roomRentDailyCap: 5000,
      roomRentExcessDays: 10,
      claimAmount: 200000,
    });
    expect(result.amount).toBe(50000);
    expect(result.components.roomRentProportionateCut).toBe(50000);
  });

  test('non-network reduction', () => {
    const result = calculateRupeeAtRisk({
      nonNetworkReductionPct: 25,
      claimAmount: 200000,
    });
    expect(result.amount).toBe(50000);
    expect(result.components.nonNetworkReduction).toBe(50000);
  });

  test('multiple components sum correctly', () => {
    const result = calculateRupeeAtRisk({
      sumInsured: 500000,
      claimAmount: 300000,
      subLimitCap: 50000,
      coPayPct: 10,
    });
    expect(result.amount).toBe(280000);
    expect(result.components.subLimitShortfall).toBe(250000);
    expect(result.components.coPayOutOfPocket).toBe(30000);
  });

  test('no scenario given returns 0', () => {
    const result = calculateRupeeAtRisk({});
    expect(result.amount).toBe(0);
    expect(result.components).toEqual({});
    expect(result.missingFields).toEqual([]);
  });
});