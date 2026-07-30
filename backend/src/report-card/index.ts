import type { Flag } from '../flag-engine/index.js';

export interface ReportCardData {
  reportGeneratedAt: string;
  policyInfo: {
    insurerName: string | null;
    policyType: string;
    sumInsured: number | null;
    premium: number | null;
  };
  score: number;
  flags: Flag[];
  settlementRatio: number | null;
  topFlags: Array<Flag & { simplifiedExplanation: string }>;
  stamps: string[];
}

export function generateReportCard(scoreData: {
  score: number;
  flags: Flag[];
  settlementRatio: number | null;
  settlementRatioMatchedInsurer: string | null;
  breakdown: Record<string, number>;
}, policyInfo: {
  insurerName?: string | null;
  sumInsured?: number | null;
  premium?: number | null;
}): ReportCardData {
  const stamps: string[] = [];

  if (scoreData.score >= 70) stamps.push('RECOMMENDED');
  if (scoreData.score >= 40 && scoreData.score < 70) stamps.push('READ_WITH_CAUTION');
  if (scoreData.score < 40) stamps.push('HIGH_RISK');
  if (scoreData.flags.filter(f => f.type === 'green').length >= 3) stamps.push('CONSUMER_FRIENDLY');
  if (scoreData.flags.some(f => f.ruleId === 'R13')) stamps.push('HAS_RESTORATION');
  if (scoreData.flags.some(f => f.ruleId === 'R02' && f.type === 'red')) stamps.push('HAS_CO_PAY');
  if (scoreData.settlementRatio !== null && scoreData.settlementRatio >= 80) stamps.push('STRONG_SETTLEMENT_RATIO');
  if (scoreData.settlementRatio !== null && scoreData.settlementRatio < 50) stamps.push('LOW_SETTLEMENT_RATIO');

  const severityOrder = { red: 0, amber: 1, green: 2 };
  const sortedFlags = [...scoreData.flags].sort(
    (a, b) => (severityOrder[a.type] ?? 2) - (severityOrder[b.type] ?? 2)
  );

  const topFlags = sortedFlags.slice(0, 3).map(f => ({
    ...f,
    simplifiedExplanation: f.explanation.length > 120
      ? f.explanation.slice(0, 117) + '...'
      : f.explanation,
  }));

  return {
    reportGeneratedAt: new Date().toISOString(),
    policyInfo: {
      insurerName: policyInfo.insurerName || null,
      policyType: 'Health Insurance',
      sumInsured: policyInfo.sumInsured || null,
      premium: policyInfo.premium || null,
    },
    score: scoreData.score,
    flags: sortedFlags,
    settlementRatio: scoreData.settlementRatio,
    topFlags,
    stamps,
  };
}