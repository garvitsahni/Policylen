import { matchFlags, type ExtractedClause, type Flag, type MatchResult } from './index.js';
import { matchInsurer } from './insurer-matcher.js';

export interface PolicyScoreResponse {
  score: number;
  maxScore: number;
  minScore: number;
  breakdown: Record<string, number>;
  settlementRatio: number | null;
  settlementRatioMatchedInsurer: string | null;
  settlementRatioSourceLabel: string;
  settlementRatioReportingPeriod: string;
  flags: Flag[];
}

export function computePolicyScore(
  clauses: ExtractedClause[],
  insurerName?: string | null
): PolicyScoreResponse {
  const { flags, score: { score, breakdown } } = matchFlags(clauses);

  const { icrPct, matchedName } = matchInsurer(insurerName);

  return {
    score,
    maxScore: 100,
    minScore: 0,
    breakdown,
    settlementRatio: icrPct,
    settlementRatioMatchedInsurer: matchedName,
    settlementRatioSourceLabel: 'IRDAI Annual Report 2024-25 (Health segment ICR)',
    settlementRatioReportingPeriod: 'FY 2024-25',
    flags,
  };
}