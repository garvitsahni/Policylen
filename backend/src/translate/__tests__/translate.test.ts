import { describe, test, expect } from 'vitest';
import { buildPrompt, LANGUAGES } from '../index.js';

describe('buildPrompt', () => {
  test('returns a prompt with the target language name', () => {
    const prompt = buildPrompt('This is a test.', 'hi');
    expect(prompt).toContain('Hindi');
    expect(prompt).toContain('hi');
    expect(prompt).toContain('This is a test.');
  });

  test('instructs to preserve numbers and rupee amounts', () => {
    const prompt = buildPrompt('Pay ₹5,000 with 20% co-pay.', 'te');
    expect(prompt).toContain('rupee amounts');
    expect(prompt).toContain('percentages');
  });

  test('all languages are valid', () => {
    for (const lang of LANGUAGES) {
      expect(lang.code).toMatch(/^[a-z]{2}$/);
      expect(lang.name.length).toBeGreaterThan(0);
      expect(lang.native.length).toBeGreaterThan(0);
    }
  });

  test('covers all major Indian languages', () => {
    const codes = LANGUAGES.map(l => l.code);
    expect(codes).toContain('hi');
    expect(codes).toContain('bn');
    expect(codes).toContain('te');
    expect(codes).toContain('ta');
    expect(codes).toContain('mr');
    expect(codes).toContain('gu');
    expect(codes).toContain('kn');
    expect(codes).toContain('ml');
  });
});