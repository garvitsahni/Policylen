import { describe, test, expect } from 'vitest';
import { COMMUNITY_CLAUSES } from '../../data/community-clauses.js';

describe('COMMUNITY_CLAUSES', () => {
  test('contains at least 10 clauses', () => {
    expect(COMMUNITY_CLAUSES.length).toBeGreaterThanOrEqual(10);
  });

  test('each clause has required fields', () => {
    for (const c of COMMUNITY_CLAUSES) {
      expect(c.id).toBeTruthy();
      expect(c.clauseType).toBeTruthy();
      expect(c.commonName).toBeTruthy();
      expect(c.typicalText).toBeTruthy();
      expect(typeof c.confirmedCount).toBe('number');
      expect(c.consumerNote).toBeTruthy();
      expect(Array.isArray(c.tags)).toBe(true);
    }
  });

  test('includes both positive and negative clauses', () => {
    const positives = COMMUNITY_CLAUSES.filter(c => c.averageImpact === 'positive');
    const negatives = COMMUNITY_CLAUSES.filter(c => c.averageImpact === 'negative');
    expect(positives.length).toBeGreaterThanOrEqual(4);
    expect(negatives.length).toBeGreaterThanOrEqual(4);
  });

  test('has unique IDs', () => {
    const ids = COMMUNITY_CLAUSES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('all confirmed counts are reasonable', () => {
    for (const c of COMMUNITY_CLAUSES) {
      expect(c.confirmedCount).toBeGreaterThanOrEqual(0);
      expect(c.confirmedCount).toBeLessThanOrEqual(10000);
    }
  });
});