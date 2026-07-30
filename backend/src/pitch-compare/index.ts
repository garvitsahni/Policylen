import type { ExtractedClause, Flag } from '../flag-engine/index.js';

export interface PitchClaim {
  claimText: string;
  claimType: string;
  statedValue: string;
}

export interface Contradiction {
  claimText: string;
  claimType: string;
  statedValue: string;
  documentValue: string;
  severity: 'contradiction' | 'warning' | 'match';
  explanation: string;
  sourceExcerpt: string;
}

const CLAIM_PATTERNS: Array<{
  type: string;
  patterns: RegExp[];
  extractValue: (match: RegExpMatchArray) => string;
}> = [
  {
    type: 'room_rent_cap',
    patterns: [
      /no\s+(room\s+)?rent\s+(cap|capping|limit)/i,
      /unlimited\s+room\s+rent/i,
      /any\s+room\s+(category|type)\s+(is\s+)?covered/i,
      /no\s+capping\s+on\s+room/i,
    ],
    extractValue: () => 'no cap',
  },
  {
    type: 'room_rent_cap',
    patterns: [
      /room\s+rent\s+(capped|limited)\s+at\s+(\d+)/i,
      /(\d+)\s*%\s+of\s+(sum\s+)?insured\s+for\s+room/i,
    ],
    extractValue: (m) => m[1] ? `capped at ${m[1]}` : 'capped',
  },
  {
    type: 'co_pay',
    patterns: [
      /no\s+co[-\s]?pay(ment)?/i,
      /zero\s+co[-\s]?pay/i,
      /0%\s+co[-\s]?pay/i,
      /no\s+out[-\s]?of[-\s]?pocket/i,
    ],
    extractValue: () => 'no co-pay',
  },
  {
    type: 'co_pay',
    patterns: [
      /(\d+)\s*%\s+co[-\s]?pay/i,
      /co[-\s]?pay(ment)?\s+of\s+(\d+)\s*%/i,
    ],
    extractValue: (m) => `${m[1]}% co-pay`,
  },
  {
    type: 'ped_waiting',
    patterns: [
      /no\s+waiting\s+period\s+(for\s+)?pre[-\s]?existing/i,
      /pre[-\s]?existing\s+(condition|disease).{0,20}(covered|pay).{0,10}(day\s*1|immediately|from\s+start)/i,
      /covers\s+pre[-\s]?existing\s+from\s+day\s*1/i,
    ],
    extractValue: () => 'no PED wait',
  },
  {
    type: 'ped_waiting',
    patterns: [
      /(\d+)\s+(month|year).{0,10}(waiting|pre.existing)/i,
      /pre[-\s]?existing.{0,20}(\d+)\s+(month|year)/i,
    ],
    extractValue: (m) => `${m[1]} ${m[2]} PED wait`,
  },
  {
    type: 'sub_limit',
    patterns: [
      /no\s+(sub[-\s]?limit|cap|limit|sublimit)/i,
      /full\s+(sum\s+)?insured\s+(for|available|payable)/i,
      /unlimited\s+coverage/i,
    ],
    extractValue: () => 'no sub-limits',
  },
  {
    type: 'sub_limit',
    patterns: [
      /(cataract|hernia|knee|hip|joint).{0,20}(cap|limit|covered\s+up\s+to)\s+(\d[\d,]*)/i,
    ],
    extractValue: (m) => `${m[3]} sub-limit for ${m[1]}`,
  },
  {
    type: 'cashless',
    patterns: [
      /cashless\s+(at|in|across|throughout)\s+/i,
      /all\s+hospitals\s+are\s+cashless/i,
      /no\s+upfront\s+payment/i,
      /cashless\s+(treatment|claim|cover)/i,
      /get\s+cashless/i,
      /you\s+get\s+cashless/i,
    ],
    extractValue: () => 'cashless coverage claimed',
  },
  {
    type: 'maternity',
    patterns: [
      /maternity\s+(covered|included|from\s+day)/i,
      /covers\s+delivery/i,
      /pregnancy\s+covered/i,
      /maternity.{0,15}(covered|included|part|available)/i,
    ],
    extractValue: () => 'maternity covered',
  },
];

function extractClaims(pitchText: string): PitchClaim[] {
  const claims: PitchClaim[] = [];
  const matched = new Set<string>();

  for (const rule of CLAIM_PATTERNS) {
    for (const pattern of rule.patterns) {
      const match = pitchText.match(pattern);
      if (match) {
        const key = match[0].slice(0, 40);
        if (matched.has(key)) continue;
        matched.add(key);
        claims.push({
          claimText: match[0],
          claimType: rule.type,
          statedValue: rule.extractValue(match),
        });
        break;
      }
    }
  }

  return claims;
}

function getField(clauses: ExtractedClause[], path: string): unknown {
  const parts = path.split('.');
  for (const clause of clauses) {
    const fields = clause.fieldsJson as Record<string, unknown>;
    let val: unknown = fields;
    for (const part of parts) {
      if (val && typeof val === 'object') {
        val = (val as Record<string, unknown>)[part];
      } else { val = undefined; break; }
    }
    if (val !== undefined) return val;
  }
  return undefined;
}

function findClauseByField(clauses: ExtractedClause[], fieldPath: string): ExtractedClause | null {
  for (const clause of clauses) {
    const fields = clause.fieldsJson as Record<string, unknown>;
    const parts = fieldPath.split('.');
    let val: unknown = fields;
    let found = true;
    for (const part of parts) {
      if (val && typeof val === 'object') {
        val = (val as Record<string, unknown>)[part];
      } else { found = false; break; }
    }
    if (found && val !== undefined) return clause;
  }
  return null;
}

function hasSubLimits(clauses: ExtractedClause[]): boolean {
  for (const clause of clauses) {
    const sl = (clause.fieldsJson as Record<string, unknown>).sub_limits;
    if (Array.isArray(sl) && sl.length > 0) return true;
  }
  return false;
}

function hasPermanentMaternityExclusion(clauses: ExtractedClause[]): boolean {
  for (const clause of clauses) {
    const ex = (clause.fieldsJson as Record<string, unknown>).exclusions;
    if (Array.isArray(ex)) {
      for (const e of ex as Array<Record<string, unknown>>) {
        const cond = (e.condition as string || '').toLowerCase();
        if ((cond.includes('maternity') || cond.includes('pregnancy') || cond.includes('delivery')) && e.is_permanent === true) {
          return true;
        }
      }
    }
  }
  return false;
}

function hasPermanentExclusionsFor(clauses: ExtractedClause[], term: string): boolean {
  for (const clause of clauses) {
    const ex = (clause.fieldsJson as Record<string, unknown>).exclusions;
    if (Array.isArray(ex)) {
      for (const e of ex as Array<Record<string, unknown>>) {
        const cond = (e.condition as string || '').toLowerCase();
        if (cond.includes(term.toLowerCase()) && e.is_permanent === true) return true;
      }
    }
  }
  return false;
}

function checkContradiction(
  claim: PitchClaim,
  clauses: ExtractedClause[]
): Contradiction {
  const check: Contradiction = {
    claimText: claim.claimText,
    claimType: claim.claimType,
    statedValue: claim.statedValue,
    documentValue: '',
    severity: 'match',
    explanation: '',
    sourceExcerpt: '',
  };

  switch (claim.claimType) {
    case 'room_rent_cap': {
      const capType = getField(clauses, 'room_rent_clause.cap_type') as string | undefined;
      const propDed = getField(clauses, 'room_rent_clause.has_proportionate_deduction')
        || getField(clauses, 'room_rent_clause.proportionate_deduction');
      const clause = findClauseByField(clauses, 'room_rent_clause.cap_type');

      if (claim.statedValue === 'no cap') {
        check.documentValue = capType === 'no_cap' ? 'no cap' : `capped (${capType || 'unknown type'})`;
        if (capType && capType !== 'no_cap') {
          check.severity = 'contradiction';
          check.explanation = `Salesperson claims no room rent cap, but the policy has a ${capType} room rent cap.${propDed ? ' It also includes a proportionate deduction clause.' : ''}`;
          check.sourceExcerpt = clause?.rawText || '';
        } else {
          check.severity = 'match';
          check.explanation = 'Confirmed: no room rent cap.';
          check.sourceExcerpt = clause?.rawText || '';
        }
      } else {
        check.documentValue = capType || 'not stated';
        if (capType && capType !== 'no_cap') {
          check.severity = 'match';
          check.explanation = 'Confirmed: room rent is capped.';
          check.sourceExcerpt = clause?.rawText || '';
        } else if (capType === 'no_cap') {
          check.severity = 'contradiction';
          check.explanation = 'Salesperson claims a cap, but the policy explicitly has no room rent cap.';
          check.sourceExcerpt = clause?.rawText || '';
        }
      }
      break;
    }

    case 'co_pay': {
      const coPayPct = getField(clauses, 'co_pay.percentage') as number | undefined;
      const clause = findClauseByField(clauses, 'co_pay.percentage');

      if (claim.statedValue === 'no co-pay') {
        check.documentValue = coPayPct !== undefined && coPayPct > 0 ? `${coPayPct}% co-pay` : 'no co-pay';
        if (coPayPct !== undefined && coPayPct > 0) {
          check.severity = 'contradiction';
          check.explanation = `Salesperson claims no co-pay, but the policy has a ${coPayPct}% co-payment clause. You pay ${coPayPct}% of every approved claim.`;
          check.sourceExcerpt = clause?.rawText || '';
        } else {
          check.severity = 'match';
          check.explanation = 'Confirmed: no co-payment clause.';
          check.sourceExcerpt = clause?.rawText || '';
        }
      } else {
        const match = claim.statedValue.match(/(\d+)/);
        const statedPct = match ? parseInt(match[1]) : 0;
        check.documentValue = coPayPct !== undefined ? `${coPayPct}%` : 'not stated';
        if (coPayPct !== undefined && coPayPct === statedPct) {
          check.severity = 'match';
          check.explanation = `Confirmed: ${coPayPct}% co-pay.`;
        } else if (coPayPct !== undefined && coPayPct !== statedPct) {
          check.severity = 'contradiction';
          check.explanation = `Salesperson claims ${statedPct}% co-pay, but the policy states ${coPayPct}%.`;
          check.sourceExcerpt = clause?.rawText || '';
        }
      }
      break;
    }

    case 'ped_waiting': {
      const pedWait = getField(clauses, 'ped_waiting_period_months') as number | undefined
        || (() => {
            for (const clause of clauses) {
              const wps = (clause.fieldsJson as Record<string, unknown>).waiting_periods;
              if (Array.isArray(wps)) {
                const ped = (wps as Array<Record<string, unknown>>).find((wp: Record<string, unknown>) => wp.period_type === 'ped');
                if (ped && typeof ped.period_months === 'number') return ped.period_months;
              }
            }
            return undefined;
          })();
      const clause = findClauseByField(clauses, 'ped_waiting_period_months')
        || (() => {
            for (const clause of clauses) {
              const wps = (clause.fieldsJson as Record<string, unknown>).waiting_periods;
              if (Array.isArray(wps) && wps.some((wp: Record<string, unknown>) => wp.period_type === 'ped')) return clause;
            }
            return null;
          })();

      if (claim.statedValue === 'no PED wait') {
        check.documentValue = pedWait ? `${pedWait} months` : 'not stated';
        if (pedWait && pedWait > 0) {
          check.severity = 'contradiction';
          check.explanation = `Salesperson claims no waiting period for pre-existing conditions, but the policy has a ${pedWait}-month PED waiting period. Claims during this period will be rejected.`;
          check.sourceExcerpt = clause?.rawText || '';
        } else {
          check.severity = 'match';
          check.explanation = 'Confirmed: no PED waiting period.';
          check.sourceExcerpt = clause?.rawText || '';
        }
      } else {
        const match = claim.statedValue.match(/(\d+)/);
        const statedMonths = match ? parseInt(match[1]) : 0;
        check.documentValue = pedWait ? `${pedWait} months` : 'not stated';
        if (pedWait && statedMonths && pedWait <= statedMonths) {
          check.severity = 'match';
          check.explanation = `Confirmed: ${pedWait}-month PED waiting period.`;
          check.sourceExcerpt = clause?.rawText || '';
        } else if (pedWait && statedMonths && pedWait > statedMonths) {
          check.severity = 'contradiction';
          check.explanation = `Salesperson claims ${statedMonths}-month PED wait, but the policy states ${pedWait} months.`;
          check.sourceExcerpt = clause?.rawText || '';
        }
      }
      break;
    }

    case 'sub_limit': {
      const hasAny = hasSubLimits(clauses);
      const clause = (() => {
        for (const c of clauses) {
          const sl = (c.fieldsJson as Record<string, unknown>).sub_limits;
          if (Array.isArray(sl) && sl.length > 0) return c;
        }
        return null;
      })();

      if (claim.statedValue === 'no sub-limits') {
        check.documentValue = hasAny ? 'sub-limits exist' : 'no sub-limits';
        if (hasAny) {
          check.severity = 'contradiction';
          check.explanation = 'Salesperson claims no sub-limits, but the policy has sub-limits on specific procedures.';
          check.sourceExcerpt = clause?.rawText || '';
        } else {
          check.severity = 'match';
          check.explanation = 'Confirmed: no sub-limits on procedures.';
          check.sourceExcerpt = clause?.rawText || '';
        }
      }
      break;
    }

    case 'cashless': {
      const cd = getField(clauses, 'network_clause.cashless_default');
      const clause = findClauseByField(clauses, 'network_clause.cashless_default');
      check.documentValue = cd === true ? 'cashless available' : 'not stated as cashless default';
      if (cd === true) {
        check.severity = 'match';
        check.explanation = 'Confirmed: cashless treatment is available.';
        check.sourceExcerpt = clause?.rawText || '';
      } else {
        check.severity = 'warning';
        check.explanation = 'Cashless treatment availability is not confirmed in the policy. Check if reimbursement is the default.';
        check.sourceExcerpt = clause?.rawText || '';
      }
      break;
    }

    case 'maternity': {
      const excluded = hasPermanentMaternityExclusion(clauses);
      const clause = (() => {
        for (const c of clauses) {
          const ex = (c.fieldsJson as Record<string, unknown>).exclusions;
          if (Array.isArray(ex)) {
            for (const e of ex as Array<Record<string, unknown>>) {
              const cond = (e.condition as string || '').toLowerCase();
              if ((cond.includes('maternity') || cond.includes('pregnancy') || cond.includes('delivery')) && e.is_permanent === true) return c;
            }
          }
        }
        return null;
      })();

      if (excluded) {
        check.documentValue = 'maternity excluded';
        check.severity = 'contradiction';
        check.explanation = 'Salesperson claims maternity is covered, but maternity/pregnancy is in the permanent exclusions list.';
        check.sourceExcerpt = clause?.rawText || '';
      } else {
        check.documentValue = 'not explicitly excluded';
        check.severity = 'match';
        check.explanation = 'Maternity is not permanently excluded. Check policy for specific maternity waiting periods.';
        check.sourceExcerpt = clause?.rawText || '';
      }
      break;
    }
  }

  return check;
}

export function comparePitch(
  pitchText: string,
  clauses: ExtractedClause[]
): {
  claims: PitchClaim[];
  contradictions: Contradiction[];
  summary: { total: number; contradictions: number; warnings: number; matches: number };
} {
  const claims = extractClaims(pitchText);
  const contradictions = claims.map(c => checkContradiction(c, clauses));

  const summary = {
    total: contradictions.length,
    contradictions: contradictions.filter(c => c.severity === 'contradiction').length,
    warnings: contradictions.filter(c => c.severity === 'warning').length,
    matches: contradictions.filter(c => c.severity === 'match').length,
  };

  return { claims, contradictions, summary };
}