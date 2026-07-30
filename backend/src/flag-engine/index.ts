import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TaxonomyFlag {
  id: string;
  name: string;
  severity?: string;
  template: string;
  triggerCondition: string;
  requiredFields: string[];
}

interface Taxonomy {
  redFlags: TaxonomyFlag[];
  greenFlags: TaxonomyFlag[];
  scoreWeights: {
    base: number;
    min: number;
    max: number;
    severityPenalty: Record<string, number>;
    greenBonus: number;
    greenBonusCap: number;
  };
}

export interface ExtractedClause {
  clauseType: string;
  rawText: string;
  pageNumber?: number | null;
  fieldsJson: Record<string, unknown>;
  confidence: string;
}

export interface Flag {
  taxonomyId: string;
  colorType: string;
  severity?: string;
  explanation: string;
  sourceExcerpt: string;
  rupeeAtRisk?: number | null;
}

export interface MatchResult {
  flags: Flag[];
  score: { score: number; breakdown: Record<string, number> };
}

let taxonomyCache: Taxonomy | null = null;

function loadTaxonomy(): Taxonomy {
  if (taxonomyCache) return taxonomyCache;
  const taxonomyPath = join(__dirname, '..', '..', '..', 'data', 'taxonomy.json');
  const raw = readFileSync(taxonomyPath, 'utf-8');
  taxonomyCache = JSON.parse(raw) as Taxonomy;
  return taxonomyCache;
}

function getField(clauses: ExtractedClause[], path: string): unknown {
  const parts = path.split('.');
  for (const clause of clauses) {
    const fields = clause.fieldsJson as Record<string, unknown>;
    let val: unknown = fields;
    for (const part of parts) {
      if (val && typeof val === 'object') {
        const obj = val as Record<string, unknown>;
        if (part in obj) {
          val = obj[part];
        } else {
          val = undefined;
          break;
        }
      } else {
        val = undefined;
        break;
      }
    }
    if (val !== undefined) return val;
  }
  return undefined;
}

function hasPermanentExclusions(clauses: ExtractedClause[]): boolean {
  for (const clause of clauses) {
    const exclusions = (clause.fieldsJson as Record<string, unknown>).exclusions;
    if (Array.isArray(exclusions)) {
      if (exclusions.some((e: Record<string, unknown>) => e.is_permanent === true)) return true;
    }
  }
  return false;
}

function hasSubLimitBelowSumInsured(clauses: ExtractedClause[]): boolean {
  const sumInsured = getField(clauses, 'sum_insured');
  if (typeof sumInsured !== 'number') return false;
  for (const clause of clauses) {
    const subLimits = (clause.fieldsJson as Record<string, unknown>).sub_limits;
    if (Array.isArray(subLimits)) {
      for (const sl of subLimits as Array<Record<string, unknown>>) {
        const cv = sl.cap_value;
        if (typeof cv === 'number' && cv < sumInsured) return true;
      }
    }
  }
  return false;
}

function hasNamedProcedureWaitPeriod(clauses: ExtractedClause[]): boolean {
  for (const clause of clauses) {
    const waitingPeriods = (clause.fieldsJson as Record<string, unknown>).waiting_periods;
    if (Array.isArray(waitingPeriods)) {
      for (const wp of waitingPeriods as Array<Record<string, unknown>>) {
        if (wp.period_type === 'specific_disease') {
          const pm = wp.period_months;
          if (typeof pm === 'number' && (pm === 12 || pm === 24)) return true;
        }
      }
    }
  }
  return false;
}

function hasAncillarySubLimit(clauses: ExtractedClause[]): boolean {
  for (const clause of clauses) {
    const subLimits = (clause.fieldsJson as Record<string, unknown>).sub_limits;
    if (Array.isArray(subLimits)) {
      for (const sl of subLimits as Array<Record<string, unknown>>) {
        const proc = (sl.procedure as string || '').toLowerCase();
        if (proc.includes('ambulance') || proc.includes('daycare') || proc.includes('pre') || proc.includes('post')) {
          return true;
        }
      }
    }
  }
  return false;
}

function getIntimationDeadlineHours(clauses: ExtractedClause[]): number | null {
  for (const clause of clauses) {
    const claimProcess = (clause.fieldsJson as Record<string, unknown>).claim_process;
    if (Array.isArray(claimProcess)) {
      const intimation = (claimProcess as Array<Record<string, unknown>>).find(
        (s: Record<string, unknown>) => (s.step_name as string || '').toLowerCase() === 'intimation'
      );
      if (intimation && typeof intimation.timeframe_hours === 'number') return intimation.timeframe_hours;
    }
  }
  return null;
}

function hasDiscretionaryLanguage(clauses: ExtractedClause[]): boolean {
  for (const clause of clauses) {
    if ((clause.fieldsJson as Record<string, unknown>).discretionary_language_excerpt) return true;
    const text = clause.rawText.toLowerCase();
    if (text.includes('sole discretion') || text.includes('reasonable and customary') ||
        text.includes('at the company\'s discretion') || text.includes('at the insurer\'s discretion') ||
        text.includes('as determined by') || text.includes('in the opinion of the company')) {
      return true;
    }
  }
  return false;
}

function evaluateRedFlag(ruleId: string, clauses: ExtractedClause[]): boolean {
  switch (ruleId) {
    case 'R01': {
      const capType = getField(clauses, 'room_rent_clause.cap_type');
      const propDed = getField(clauses, 'room_rent_clause.has_proportionate_deduction');
      const propDedShort = getField(clauses, 'room_rent_clause.proportionate_deduction');
      const capTypeStr = typeof capType === 'string' ? capType : '';
      const isCapped = capTypeStr.includes('percent') || capTypeStr.includes('fixed') || capTypeStr === 'fixed_amount_per_day' || capTypeStr === 'percentage_of_sum_insured';
      return isCapped && (propDed === true || propDedShort === true);
    }
    case 'R02': return hasSubLimitBelowSumInsured(clauses);
    case 'R03': {
      const pct = getField(clauses, 'co_pay.percentage');
      return typeof pct === 'number' && pct > 0;
    }
    case 'R04': {
      const ped = getField(clauses, 'ped_waiting_period_months');
      if (typeof ped === 'number' && ped > 24) return true;
      for (const clause of clauses) {
        const wps = (clause.fieldsJson as Record<string, unknown>).waiting_periods;
        if (Array.isArray(wps)) {
          const pedWp = (wps as Array<Record<string, unknown>>).find(wp => wp.period_type === 'ped');
          if (pedWp && typeof pedWp.period_months === 'number' && pedWp.period_months > 24) return true;
        }
      }
      return false;
    }
    case 'R05': {
      const init = getField(clauses, 'initial_waiting_days');
      const hasInitialWait = (typeof init === 'number' && init >= 30);
      for (const clause of clauses) {
        const wps = (clause.fieldsJson as Record<string, unknown>).waiting_periods;
        if (Array.isArray(wps)) {
          const hasInitialType = (wps as Array<Record<string, unknown>>).some(
            wp => wp.period_type === 'initial' && wp.period_months === 1
          );
          if (hasInitialType) return true;
        }
      }
      return hasInitialWait;
    }
    case 'R06': return hasNamedProcedureWaitPeriod(clauses);
    case 'R07': {
      const present = getField(clauses, 'non_disclosure_clause_present');
      const scope = getField(clauses, 'non_disclosure_scope');
      return present === true && scope === 'broad_any_non_disclosure';
    }
    case 'R08': return hasDiscretionaryLanguage(clauses);
    case 'R09': return hasAncillarySubLimit(clauses);
    case 'R10': {
      const reduced = getField(clauses, 'network_clause.non_network_payout_reduced');
      return reduced === true;
    }
    case 'R11': {
      const loading = getField(clauses, 'renewal_clause.claims_based_loading');
      const guaranteed = getField(clauses, 'renewal_clause.guaranteed_renewal');
      return loading === true || guaranteed === false;
    }
    case 'R12': return hasPermanentExclusions(clauses);
    case 'R13': {
      const deadline = getIntimationDeadlineHours(clauses);
      return deadline !== null && deadline <= 48;
    }
    default: return false;
  }
}

function evaluateGreenFlag(ruleId: string, clauses: ExtractedClause[]): boolean {
  switch (ruleId) {
    case 'G01': {
      const capType = getField(clauses, 'room_rent_clause.cap_type');
      return capType === 'no_cap';
    }
    case 'G02': {
      const absent = getField(clauses, 'co_pay.explicitly_absent');
      const pct = getField(clauses, 'co_pay.percentage');
      return absent === true || pct === 0;
    }
    case 'G03': {
      const ped = getField(clauses, 'ped_waiting_period_months');
      const stated = getField(clauses, 'ped_explicitly_stated');
      return typeof ped === 'number' && ped <= 24 && stated === true;
    }
    case 'G04': {
      const present = getField(clauses, 'restoration_benefit.present');
      return present === true;
    }
    case 'G05': {
      const statement = getField(clauses, 'no_sub_limits_statement_present');
      return statement === true;
    }
    case 'G06': {
      const present = getField(clauses, 'cumulative_bonus.present');
      return present === true;
    }
    case 'G07': {
      const cashless = getField(clauses, 'network_clause.cashless_default');
      const sizeStated = getField(clauses, 'network_clause.network_size_stated');
      return cashless === true && sizeStated === true;
    }
    default: return false;
  }
}

function fillTemplate(template: string, clause: ExtractedClause | null, allClauses: ExtractedClause[]): string {
  const fields = clause?.fieldsJson as Record<string, unknown> | undefined;
  let result = template;
  result = result.replace(/\{cap_value\}/g, () => {
    const cc = fields?.room_rent_clause as Record<string, unknown> | undefined;
    const cv = cc?.cap_value;
    if (typeof cv === 'number') return cv.toString();
    const rc = getField(allClauses, 'room_rent_clause.cap_value');
    return rc !== undefined ? String(rc) : 'a certain amount';
  });
  result = result.replace(/\{sum_insured\}/g, () => {
    const si = getField(allClauses, 'sum_insured');
    return si !== undefined ? `₹${Number(si).toLocaleString('en-IN')}` : 'the sum insured';
  });
  result = result.replace(/\{procedure\}/g, () => (fields?.procedure as string) || 'this procedure');
  result = result.replace(/\{sub_limit_value\}/g, () => {
    const cv = fields?.cap_value;
    return cv !== undefined ? `₹${Number(cv).toLocaleString('en-IN')}` : 'a capped amount';
  });
  result = result.replace(/\{co_pay_pct\}/g, () => {
    const cp = fields?.co_pay as Record<string, unknown> | undefined;
    return cp?.percentage !== undefined ? String(cp.percentage) : 'a certain percentage';
  });
  result = result.replace(/\{calculated_amount\}/g, () => {
    const cp = fields?.co_pay as Record<string, unknown> | undefined;
    const pct = typeof cp?.percentage === 'number' ? cp.percentage : 0;
    return `₹${((pct / 100) * 200000).toLocaleString('en-IN')}`;
  });
  result = result.replace(/\{waiting_period\}/g, () => (fields?.period_months as string) || (fields?.period_months as number)?.toString() || 'a certain period');
  result = result.replace(/\{condition\}/g, () => (fields?.condition as string) || 'a pre-existing condition');
  result = result.replace(/\{condition_or_treatment\}/g, () => (fields?.condition as string) || 'this condition');
  result = result.replace(/\{timeframe\}/g, () => {
    const deadline = getIntimationDeadlineHours(allClauses);
    return deadline !== null ? `${deadline} hours` : 'the specified timeframe';
  });
  result = result.replace(/\{value\}/g, () => {
    const cv = fields?.cap_value;
    return cv !== undefined ? `₹${Number(cv).toLocaleString('en-IN')}` : 'a capped amount';
  });
  result = result.replace(/\{insurer\}/g, () => {
    const ins = getField(allClauses, 'insurer_name');
    return (ins as string) || 'the insurer';
  });
  result = result.replace(/\{examples\}/g, 'cataract, hernia, joint replacement');
  return result;
}

function findMatchingClause(clauses: ExtractedClause[], rule: TaxonomyFlag): ExtractedClause | null {
  if (rule.requiredFields.length === 0) {
    return clauses[0] || null;
  }
for (const clause of clauses) {
    const fields = clause.fieldsJson as Record<string, unknown>;
    for (const field of rule.requiredFields) {
      const parts = field.split('_');
      let val: unknown = fields;
      for (const part of parts) {
        if (val && typeof val === 'object') {
          val = (val as Record<string, unknown>)[part];
        } else {
          val = undefined;
          break;
        }
      }
      if (val !== undefined) return clause;
    }
  }
  if (clauses.length > 0) return clauses[0];
  return null;
}

export function matchFlags(clauses: ExtractedClause[]): MatchResult {
  const taxonomy = loadTaxonomy();
  const flags: Flag[] = [];
  let score = taxonomy.scoreWeights.base;
  const breakdown: Record<string, number> = {};

  for (const rule of taxonomy.redFlags) {
    const triggered = evaluateRedFlag(rule.id, clauses);
    if (triggered) {
      const sourceClause = findMatchingClause(clauses, rule);
      const explanation = sourceClause ? fillTemplate(rule.template, sourceClause, clauses) : rule.template;
      const penalty = taxonomy.scoreWeights.severityPenalty[rule.severity || 'medium'] || 8;
      score -= penalty;
      breakdown[rule.id] = -penalty;
      flags.push({
        taxonomyId: rule.id,
        colorType: 'red',
        severity: rule.severity,
        explanation,
        sourceExcerpt: sourceClause?.rawText || '',
      });
    }
  }

  const greenBonusCap = taxonomy.scoreWeights.greenBonusCap;
  let greenBonusUsed = 0;
  for (const rule of taxonomy.greenFlags) {
    const triggered = evaluateGreenFlag(rule.id, clauses);
    if (triggered && greenBonusUsed < greenBonusCap) {
      const sourceClause = findMatchingClause(clauses, rule);
      const explanation = sourceClause ? fillTemplate(rule.template, sourceClause, clauses) : rule.template;
      score += taxonomy.scoreWeights.greenBonus;
      greenBonusUsed += taxonomy.scoreWeights.greenBonus;
      breakdown[rule.id] = taxonomy.scoreWeights.greenBonus;
      flags.push({
        taxonomyId: rule.id,
        colorType: 'green',
        explanation,
        sourceExcerpt: sourceClause?.rawText || '',
      });
    }
  }

  score = Math.max(taxonomy.scoreWeights.min, Math.min(taxonomy.scoreWeights.max, score));
  return { flags, score: { score, breakdown } };
}