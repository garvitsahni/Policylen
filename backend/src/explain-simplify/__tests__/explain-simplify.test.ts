import { simplifyExplanation } from '../index.js';

describe('simplifyExplanation', () => {
  it('rewrites co-payment sentence with plain language', () => {
    const result = simplifyExplanation('A co-payment of 20% applies to all hospital admissions.');
    expect(result).toContain('you pay');
    expect(result).toContain('20%');
    expect(result).toContain('80');
  });

  it('rewrites room rent cap with proportionate deduction', () => {
    const result = simplifyExplanation('Room rent clause with proportionate deduction.');
    expect(result).toContain('costs more');
    expect(result).not.toMatch(/deduc/i);
  });

  it('rewrites PED waiting period', () => {
    const result = simplifyExplanation('Pre-existing diseases have a 48-month waiting period.');
    expect(result).toContain('48');
    expect(result).toContain('rejected');
  });

  it('rewrites sub-limit with amount', () => {
    const result = simplifyExplanation('A sub-limit on cataract surgery of ₹25,000.');
    expect(result).toContain('₹25,000');
  });

  it('rewrites permanent maternity exclusion', () => {
    const result = simplifyExplanation('Maternity expenses are permanently excluded.');
    expect(result).toContain('never covered');
  });

  it('rewrites cashless mention', () => {
    const result = simplifyExplanation('Cashless treatment is available at network hospitals.');
    expect(result).toContain('hospital directly');
  });

  it('rewrites no co-pay confirmation', () => {
    const result = simplifyExplanation('No co-payment clause applies.');
    expect(result).toContain('do not have to pay');
  });

  it('rewrites settlement ratio mention', () => {
    const result = simplifyExplanation('Settlement ratio of 85% shows strong claim payment history.');
    expect(result).toContain('85%');
    expect(result).toContain('Higher is better');
  });

  it('handles empty input', () => {
    expect(simplifyExplanation('')).toBe('');
  });

  it('adds period if missing', () => {
    const result = simplifyExplanation('No room rent cap');
    expect(result.endsWith('.')).toBe(true);
  });

  it('replaces IRDAI with plain explanation', () => {
    const result = simplifyExplanation('IRDAI regulates all health insurance policies.');
    expect(result).toContain('government body');
  });

  it('replaces irdai lowercase', () => {
    const result = simplifyExplanation('irdai reference data.');
    expect(result).toContain('government body');
  });

  it('rewrites "not stated" message', () => {
    const result = simplifyExplanation('This value is not stated in document.');
    expect(result).toContain('not found');
  });

  it('handles restoration benefit', () => {
    const result = simplifyExplanation('Restoration benefit available for sum insured.');
    expect(result).toContain('topped back up');
  });

  it('handles room rent with no cap', () => {
    const result = simplifyExplanation('No room rent cap clause applies.');
    expect(result).toContain('No limit');
  });

  it('handles generic text with legal phrasing', () => {
    const result = simplifyExplanation('This is applicable in accordance with the policy terms.');
    expect(result).toContain('applies');
    expect(result).toContain('as per');
  });

  it('truncates very long rewrites at 600', () => {
    const result = simplifyExplanation('A '.repeat(700));
    expect(result.length).toBeLessThanOrEqual(600);
  });

  it('rewrites no sub-limit', () => {
    const result = simplifyExplanation('No sub-limit on any procedure.');
    expect(result).toContain('No sub-limits');
  });
});