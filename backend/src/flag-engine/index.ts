import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { calculateRupeeAtRisk } from './rupee-at-risk.js';

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

function getFieldFromClause(clause: ExtractedClause, path: string): unknown {
  const parts = path.split('.');
  const fields = clause.fieldsJson as Record<string, unknown>;
  let val: unknown = fields;
  for (const part of parts) {
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      if (part in obj) {
        val = obj[part];
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  }
  return val;
}

const DISCRETIONARY_PATTERNS = [
  'sole discretion',
  'reasonable and customary',
  "at the company's discretion",
  "at the insurer's discretion",
  'as determined by',
  'in the opinion of the company',
];

const RULE_SOURCE_PATHS: Record<string, string[]> = {
  R01: ['room_rent_clause.cap_type', 'room_rent_clause.cap_value'],
  R02: ['sum_insured', 'sub_limits'],
  R03: ['co_pay.percentage'],
  R04: ['ped_waiting_period_months', 'waiting_periods'],
  R05: ['initial_waiting_days', 'waiting_periods'],
  R06: ['waiting_periods'],
  R07: ['non_disclosure_clause_present', 'non_disclosure_scope'],
  R08: ['discretionary_language_excerpt'],
  R09: ['sub_limits'],
  R10: ['network_clause.non_network_payout_reduced'],
  R11: ['renewal_clause.claims_based_loading', 'renewal_clause.guaranteed_renewal'],
  R12: ['exclusions'],
  R13: ['claim_process'],
  G01: ['room_rent_clause.cap_type'],
  G02: ['co_pay.explicitly_absent', 'co_pay.percentage'],
  G03: ['ped_waiting_period_months', 'ped_explicitly_stated'],
  G04: ['restoration_benefit.present'],
  G05: ['no_sub_limits_statement_present'],
  G06: ['cumulative_bonus.present'],
  G07: ['network_clause.cashless_default', 'network_clause.network_size_stated'],
};

function findInArrays(
  clauses: ExtractedClause[],
  arrayPath: string,
  entryField: string,
  predicate?: (entry: Record<string, unknown>) => boolean
): unknown {
  for (const clause of clauses) {
    const arr = getFieldFromClause(clause, arrayPath);
    if (Array.isArray(arr)) {
      for (const entry of arr) {
        if (entry && typeof entry === 'object') {
          const obj = entry as Record<string, unknown>;
          if (entryField in obj && (!predicate || predicate(obj))) return obj[entryField];
        }
      }
    }
  }
  return undefined;
}

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
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

function resolveWaitingPeriodMonths(clauses: ExtractedClause[], ruleId: string): number | undefined {
  let n: unknown;
  if (ruleId === 'R06') {
    n = findInArrays(clauses, 'waiting_periods', 'period_months', e => e.period_type === 'specific_disease');
  } else if (ruleId === 'R04' || ruleId === 'G03') {
    n = getField(clauses, 'ped_waiting_period_months');
    if (typeof n !== 'number') {
      n = findInArrays(clauses, 'waiting_periods', 'period_months', e => e.period_type === 'ped');
    }
  }
  return typeof n === 'number' ? n : undefined;
}

function resolveCondition(clauses: ExtractedClause[], ruleId: string): string | undefined {
  if (ruleId === 'R12') {
    const c = findInArrays(clauses, 'exclusions', 'condition');
    if (typeof c === 'string') return c;
  }
  if (ruleId === 'R06') {
    const c = findInArrays(clauses, 'waiting_periods', 'condition', e => e.period_type === 'specific_disease');
    if (typeof c === 'string') return c;
  }
  if (ruleId === 'R04') {
    const c = findInArrays(clauses, 'waiting_periods', 'condition', e => e.period_type === 'ped');
    if (typeof c === 'string') return c;
  }
  return undefined;
}

function fillTemplate(template: string, ruleId: string, _clause: ExtractedClause | null, allClauses: ExtractedClause[]): string {
  let result = template;

  result = result.replace(/\{cap_value\}/g, () => {
    const cc = getField(allClauses, 'room_rent_clause') as Record<string, unknown> | undefined;
    const cv = cc?.cap_value;
    const capType = String(cc?.cap_type || '');
    if (typeof cv === 'number') {
      if (capType.includes('percent')) return `${cv}% of your sum insured`;
      if (capType.includes('fixed')) return `${formatCurrency(cv)}/day`;
      return cv.toString();
    }
    return 'a certain amount';
  });

  result = result.replace(/\{sum_insured\}/g, () => {
    const si = getField(allClauses, 'sum_insured');
    return typeof si === 'number' ? formatCurrency(si) : 'the sum insured';
  });

  result = result.replace(/\{procedure\}/g, () => {
    const fromSub = findInArrays(allClauses, 'sub_limits', 'procedure');
    if (typeof fromSub === 'string') return fromSub;
    const fromWp = findInArrays(allClauses, 'waiting_periods', 'condition');
    if (typeof fromWp === 'string') return fromWp;
    return 'this procedure';
  });

  result = result.replace(/\{sub_limit_value\}/g, () => {
    const cv = findInArrays(allClauses, 'sub_limits', 'cap_value');
    return typeof cv === 'number' ? formatCurrency(cv) : 'a capped amount';
  });

  result = result.replace(/\{co_pay_pct\}/g, () => {
    const cp = getField(allClauses, 'co_pay') as Record<string, unknown> | undefined;
    return cp?.percentage !== undefined ? String(cp.percentage) : 'a certain percentage';
  });

  result = result.replace(/\{calculated_amount\}/g, () => {
    const cp = getField(allClauses, 'co_pay') as Record<string, unknown> | undefined;
    const pct = typeof cp?.percentage === 'number' ? cp.percentage : 0;
    const si = getField(allClauses, 'sum_insured');
    const base = typeof si === 'number' && si > 0 ? si : 200000;
    return formatCurrency(Math.round((pct / 100) * base));
  });

  result = result.replace(/\{waiting_period\}/g, () => {
    const n = resolveWaitingPeriodMonths(allClauses, ruleId);
    return typeof n === 'number' ? `${n} months` : 'a certain period';
  });

  result = result.replace(/\{condition\}/g, () => resolveCondition(allClauses, ruleId) || 'a pre-existing condition');
  result = result.replace(/\{condition_or_treatment\}/g, () => resolveCondition(allClauses, ruleId) || 'this condition');

  result = result.replace(/\{timeframe\}/g, () => {
    const deadline = getIntimationDeadlineHours(allClauses);
    return deadline !== null ? `${deadline} hours` : 'the specified timeframe';
  });

  result = result.replace(/\{value\}/g, () => {
    const cv = findInArrays(allClauses, 'sub_limits', 'cap_value');
    return typeof cv === 'number' ? formatCurrency(cv) : 'a capped amount';
  });

  result = result.replace(/\{insurer\}/g, () => {
    const ins = getField(allClauses, 'insurer_name');
    return typeof ins === 'string' ? ins : 'the insurer';
  });

  result = result.replace(/\{examples\}/g, 'cataract, hernia, joint replacement');
  return result;
}

function findMatchingClause(clauses: ExtractedClause[], rule: TaxonomyFlag): ExtractedClause | null {
  const paths = RULE_SOURCE_PATHS[rule.id];
  if (paths && paths.length > 0) {
    for (const clause of clauses) {
      for (const path of paths) {
        if (getFieldFromClause(clause, path) !== undefined) return clause;
      }
      if (rule.id === 'R08') {
        const text = (clause.rawText || '').toLowerCase();
        if (DISCRETIONARY_PATTERNS.some(p => text.includes(p))) return clause;
      }
    }
  }
  return clauses[0] || null;
}

function computeFlagRupeeAtRisk(ruleId: string, clauses: ExtractedClause[]): number | null {
  const si = getField(clauses, 'sum_insured');
  const sumInsured = typeof si === 'number' && si > 0 ? si : null;

  switch (ruleId) {
    case 'R03': {
      const cp = getField(clauses, 'co_pay') as Record<string, unknown> | undefined;
      const pct = typeof cp?.percentage === 'number' ? cp.percentage : null;
      if (pct !== null && pct > 0 && sumInsured !== null) {
        return calculateRupeeAtRisk({ claimAmount: sumInsured, coPayPct: pct }).amount;
      }
      return null;
    }
    case 'R02': {
      const cap = findInArrays(clauses, 'sub_limits', 'cap_value');
      if (sumInsured !== null && typeof cap === 'number' && cap > 0) {
        return calculateRupeeAtRisk({ sumInsured, claimAmount: sumInsured, subLimitCap: cap }).amount;
      }
      return null;
    }
    default:
      return null;
  }
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
      const explanation = sourceClause ? fillTemplate(rule.template, rule.id, sourceClause, clauses) : rule.template;
      const penalty = taxonomy.scoreWeights.severityPenalty[rule.severity.toLowerCase()] || 8;
      score -= penalty;
      breakdown[rule.id] = -penalty;
      flags.push({
        taxonomyId: rule.id,
        colorType: 'red',
        severity: rule.severity,
        explanation,
        sourceExcerpt: sourceClause?.rawText || '',
        rupeeAtRisk: computeFlagRupeeAtRisk(rule.id, clauses),
      });
    }
  }

  const greenBonusCap = taxonomy.scoreWeights.greenBonusCap;
  let greenBonusUsed = 0;
  for (const rule of taxonomy.greenFlags) {
    const triggered = evaluateGreenFlag(rule.id, clauses);
    if (triggered && greenBonusUsed < greenBonusCap) {
      const sourceClause = findMatchingClause(clauses, rule);
      const explanation = sourceClause ? fillTemplate(rule.template, rule.id, sourceClause, clauses) : rule.template;
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