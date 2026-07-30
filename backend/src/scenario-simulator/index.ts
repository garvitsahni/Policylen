import type { ExtractedClause, Flag, MatchResult } from '../flag-engine/index.js';

export interface ScenarioCostLineItem {
  label: string;
  amount: number;
  covered: boolean;
  note: string;
}

export interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  scenarioDescription: string;
  estimatedTotalCost: number;
  estimatedCovered: number;
  estimatedOutOfPocket: number;
  summary: string;
  narrative: string;
  lineItems: ScenarioCostLineItem[];
  relevantFlags: Array<{ taxonomyId: string; colorType: string; explanation: string }>;
}

function currency(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

function getField(clauses: ExtractedClause[], path: string): unknown {
  const parts = path.split('.');
  for (const clause of clauses) {
    const fields = clause.fieldsJson as Record<string, unknown>;
    let val: unknown = fields;
    for (const part of parts) {
      if (val && typeof val === 'object') {
        val = (val as Record<string, unknown>)[part];
      } else {
        val = undefined;
        break;
      }
    }
    if (val !== undefined) return val;
  }
  return undefined;
}

function getSubLimits(clauses: ExtractedClause[]): Array<Record<string, unknown>> {
  for (const clause of clauses) {
    const sl = (clause.fieldsJson as Record<string, unknown>).sub_limits;
    if (Array.isArray(sl)) return sl as Array<Record<string, unknown>>;
  }
  return [];
}

function getExclusions(clauses: ExtractedClause[]): Array<Record<string, unknown>> {
  for (const clause of clauses) {
    const ex = (clause.fieldsJson as Record<string, unknown>).exclusions;
    if (Array.isArray(ex)) return ex as Array<Record<string, unknown>>;
  }
  return [];
}

function getWaitingPeriods(clauses: ExtractedClause[]): Array<Record<string, unknown>> {
  for (const clause of clauses) {
    const wp = (clause.fieldsJson as Record<string, unknown>).waiting_periods;
    if (Array.isArray(wp)) return wp as Array<Record<string, unknown>>;
  }
  return [];
}

function findProcedureSubLimit(clauses: ExtractedClause[], procedure: string): number | null {
  const subLimits = getSubLimits(clauses);
  const match = subLimits.find(sl =>
    (sl.procedure as string || '').toLowerCase().includes(procedure.toLowerCase())
  );
  if (match && typeof match.cap_value === 'number') return match.cap_value;
  return null;
}

function isProcedureExcluded(clauses: ExtractedClause[], procedure: string): boolean {
  const exclusions = getExclusions(clauses);
  return exclusions.some(ex =>
    (ex.condition as string || '').toLowerCase().includes(procedure.toLowerCase())
  );
}

function findNamedWaitingPeriod(clauses: ExtractedClause[], condition: string): { months: number; periodType: string } | null {
  const wps = getWaitingPeriods(clauses);
  for (const wp of wps) {
    if ((wp.condition as string || '').toLowerCase().includes(condition.toLowerCase())) {
      return { months: wp.period_months as number, periodType: wp.period_type as string };
    }
  }
  return null;
}

/* ─── Scenario Definitions ─── */

export function simulateHospitalization(clauses: ExtractedClause[], flags: MatchResult['flags']): ScenarioResult {
  const sumInsured = getField(clauses, 'sum_insured') as number | undefined || 500000;
  const coPay = getField(clauses, 'co_pay.percentage') as number | undefined || 0;
  const roomRentCap = getField(clauses, 'room_rent_clause.cap_value') as number | undefined || null;
  const roomRentCapType = getField(clauses, 'room_rent_clause.cap_type') as string | undefined || '';
  const hasPropDed = getField(clauses, 'room_rent_clause.has_proportionate_deduction') as boolean | undefined
    || getField(clauses, 'room_rent_clause.proportionate_deduction') as boolean | undefined || false;

  const estimatedTotal = 250000;
  const roomRentCost = 50000;
  const treatmentCost = 200000;

  const lineItems: ScenarioCostLineItem[] = [];
  let covered = 0;
  let outOfPocket = 0;

  // Room rent check
  let roomCovered = roomRentCost;
  let roomNote = 'Room charges are fully covered.';
  if (roomRentCapType) {
    if (roomRentCapType.includes('percent') && sumInsured) {
      const capAmount = sumInsured * ((roomRentCap || 2) / 100);
      if (roomRentCost > capAmount) {
        roomCovered = capAmount;
        roomNote = `Room rent capped at ${roomRentCap || 2}% of sum insured = ${currency(Math.round(capAmount))}. You pay the difference of ${currency(roomRentCost - Math.round(capAmount))}.`;
        if (hasPropDed) {
          roomNote += ` The insurer also proportionately reduces the ENTIRE claim, not just the room charge.`;
        }
      }
    } else if (roomRentCapType.includes('fixed') && roomRentCap) {
      if (roomRentCost > roomRentCap) {
        roomCovered = roomRentCap;
        roomNote = `Room rent capped at ${currency(roomRentCap)} per day. You pay the difference.`;
      }
    }
  }
  lineItems.push({ label: 'Room Rent (5 days)', amount: roomRentCost, covered: true, note: roomNote });
  covered += Math.round(roomCovered);
  outOfPocket += roomRentCost - Math.round(roomCovered);

  // Treatment cost
  let treatmentCovered = treatmentCost;
  let treatmentNote = 'Treatment costs are fully covered.';
  const treatmentSubLimit = findProcedureSubLimit(clauses, 'hospitalization');
  if (treatmentSubLimit && treatmentSubLimit < treatmentCost) {
    treatmentCovered = treatmentSubLimit;
    treatmentNote = `Treatment sub-limited to ${currency(treatmentSubLimit)}. You pay the difference of ${currency(treatmentCost - treatmentSubLimit)}.`;
  }
  lineItems.push({ label: 'Medical Treatment', amount: treatmentCost, covered: true, note: treatmentNote });
  covered += treatmentCovered;
  outOfPocket += treatmentCost - treatmentCovered;

  // Co-pay
  if (coPay > 0) {
    const coPayAmount = Math.round((covered * coPay) / 100);
    lineItems.push({ label: `Co-pay (${coPay}%)`, amount: coPayAmount, covered: false, note: `You pay ${coPay}% of the approved amount = ${currency(coPayAmount)}.` });
    outOfPocket += coPayAmount;
  }

  const relevantFlags = flags.filter(f => ['R01', 'R02', 'R03', 'R09'].includes(f.taxonomyId));

  const totalCovered = covered;
  const totalOutOfPocket = outOfPocket;
  const narrative = (
    `You're admitted for ${currency(estimatedTotal)} of care. ` +
    `Your policy covers ${currency(totalCovered)}. ` +
    `You pay ${currency(totalOutOfPocket)} out of pocket. ` +
    (relevantFlags.length > 0
      ? ` ${relevantFlags.length} clause(s) affect this scenario, including: ${relevantFlags.map(f => f.taxonomyId).join(', ')}.`
      : ' No restrictive clauses apply to this scenario.') +
    (coPay > 0 ? ` Your ${coPay}% co-pay adds ${currency(Math.round(totalCovered * coPay / 100))} to your bill.` : '')
  );

  return {
    scenarioId: 'hospitalization',
    scenarioName: 'Planned Hospitalization',
    scenarioDescription: `A 5-day hospital stay with treatment costing ${currency(estimatedTotal)}.`,
    estimatedTotalCost: estimatedTotal,
    estimatedCovered: totalCovered,
    estimatedOutOfPocket: totalOutOfPocket,
    summary: `Covered: ${currency(totalCovered)} | You pay: ${currency(totalOutOfPocket)}`,
    narrative,
    lineItems,
    relevantFlags,
  };
}

export function simulateNamedSurgery(clauses: ExtractedClause[], flags: MatchResult['flags']): ScenarioResult {
  const sumInsured = getField(clauses, 'sum_insured') as number | undefined || 500000;
  const coPay = getField(clauses, 'co_pay.percentage') as number | undefined || 0;
  const procedure = 'Cataract';
  const procedureCost = 60000;
  const subLimit = findProcedureSubLimit(clauses, 'cataract');
  const waitPeriod = findNamedWaitingPeriod(clauses, 'cataract');
  const excluded = isProcedureExcluded(clauses, 'cataract');

  const lineItems: ScenarioCostLineItem[] = [];
  let covered = 0;
  let outOfPocket = 0;

  if (excluded) {
    lineItems.push({ label: `${procedure} Surgery`, amount: procedureCost, covered: false, note: 'This procedure is permanently excluded from coverage.' });
    outOfPocket += procedureCost;
  } else if (waitPeriod) {
    lineItems.push({ label: `${procedure} Surgery`, amount: procedureCost, covered: false, note: `Waiting period of ${waitPeriod.months} months applies. Claim will be rejected if within this period.` });
    outOfPocket += procedureCost;
  } else if (subLimit && subLimit < procedureCost) {
    const slitCover = subLimit;
    const slitGap = procedureCost - subLimit;
    lineItems.push({ label: `${procedure} Surgery`, amount: procedureCost, covered: true, note: `Covered up to sub-limit of ${currency(subLimit)}. You pay the gap of ${currency(slitGap)}.` });
    covered += slitCover;
    outOfPocket += slitGap;
  } else {
    lineItems.push({ label: `${procedure} Surgery`, amount: procedureCost, covered: true, note: 'Fully covered under sum insured.' });
    covered += procedureCost;
  }

  if (coPay > 0 && covered > 0) {
    const cpAmt = Math.round((covered * coPay) / 100);
    lineItems.push({ label: `Co-pay (${coPay}%)`, amount: cpAmt, covered: false, note: `${coPay}% of approved amount = ${currency(cpAmt)}.` });
    outOfPocket += cpAmt;
  }

  const relevantFlags = flags.filter(f => ['R02', 'R06', 'R12'].includes(f.taxonomyId));

  const narrative = excluded
    ? `${procedure} surgery is permanently excluded from your policy. The full cost of ${currency(procedureCost)} would be out of pocket.`
    : waitPeriod
      ? `${procedure} surgery has a waiting period of ${waitPeriod.months} months. If you need this surgery within that period, the claim will be rejected and you'll pay ${currency(procedureCost)} yourself.`
      : `${procedure} surgery costs ${currency(procedureCost)}. Your policy covers ${currency(covered)}, and you pay ${currency(outOfPocket)} out of pocket.`;

  return {
    scenarioId: 'named-surgery',
    scenarioName: `${procedure} Surgery`,
    scenarioDescription: `A routine ${procedure} surgery costing ${currency(procedureCost)}.`,
    estimatedTotalCost: procedureCost,
    estimatedCovered: covered,
    estimatedOutOfPocket: outOfPocket,
    summary: `Covered: ${currency(covered)} | You pay: ${currency(outOfPocket)}`,
    narrative,
    lineItems,
    relevantFlags,
  };
}

export function simulatePEDClaim(clauses: ExtractedClause[], flags: MatchResult['flags']): ScenarioResult {
  const sumInsured = getField(clauses, 'sum_insured') as number | undefined || 500000;
  const coPay = getField(clauses, 'co_pay.percentage') as number | undefined || 0;
  const pedWaitMonths = getField(clauses, 'ped_waiting_period_months') as number | undefined
    || (() => {
        const wps = getWaitingPeriods(clauses);
        const ped = wps.find(wp => wp.period_type === 'ped');
        return ped ? ped.period_months as number : null;
      })() || 48;
  const claimAmount = 300000;

  const lineItems: ScenarioCostLineItem[] = [];
  let covered = 0;
  let outOfPocket = 0;

  if (pedWaitMonths > 24) {
    lineItems.push({
      label: 'PED Treatment Claim', amount: claimAmount, covered: false,
      note: `Pre-existing disease waiting period is ${pedWaitMonths} months. Claims during this period are rejected.`,
    });
    outOfPocket += claimAmount;
  } else {
    lineItems.push({
      label: 'PED Treatment Claim', amount: claimAmount, covered: true,
      note: `PED waiting period of ${pedWaitMonths} months has been completed. Claim is eligible for coverage.`,
    });
    covered += claimAmount;
  }

  if (coPay > 0 && covered > 0) {
    const cpAmt = Math.round((covered * coPay) / 100);
    lineItems.push({ label: `Co-pay (${coPay}%)`, amount: cpAmt, covered: false, note: `${coPay}% of approved amount = ${currency(cpAmt)}.` });
    outOfPocket += cpAmt;
  }

  const relevantFlags = flags.filter(f => ['R04', 'R07'].includes(f.taxonomyId));

  const narrative = pedWaitMonths > 24
    ? `Your policy has a PED waiting period of ${pedWaitMonths} months. A claim of ${currency(claimAmount)} for a pre-existing condition during this period would be rejected. You would pay the full ${currency(claimAmount)} yourself.`
    : `Your PED waiting period of ${pedWaitMonths} months is below the industry threshold. A claim of ${currency(claimAmount)} for a pre-existing condition would be eligible for coverage.`;

  return {
    scenarioId: 'ped-claim',
    scenarioName: 'Pre-existing Disease Claim',
    scenarioDescription: `A claim for a pre-existing condition costing ${currency(claimAmount)}.`,
    estimatedTotalCost: claimAmount,
    estimatedCovered: covered,
    estimatedOutOfPocket: outOfPocket,
    summary: `Covered: ${currency(covered)} | You pay: ${currency(outOfPocket)}`,
    narrative,
    lineItems,
    relevantFlags,
  };
}

export function simulateMaternity(clauses: ExtractedClause[], flags: MatchResult['flags']): ScenarioResult {
  const sumInsured = getField(clauses, 'sum_insured') as number | undefined || 500000;
  const deliveryCost = 80000;
  const prePostCost = 20000;
  const newbornCost = 15000;

  const lineItems: ScenarioCostLineItem[] = [];
  let covered = 0;
  let outOfPocket = 0;

  const excluded = isProcedureExcluded(clauses, 'maternity')
    || isProcedureExcluded(clauses, 'pregnancy')
    || isProcedureExcluded(clauses, 'delivery');

  if (excluded) {
    lineItems.push({ label: 'Delivery Charges', amount: deliveryCost, covered: false, note: 'Maternity is excluded from this policy.' });
    lineItems.push({ label: 'Pre/Post-natal Care', amount: prePostCost, covered: false, note: 'Excluded.' });
    lineItems.push({ label: 'Newborn Care', amount: newbornCost, covered: false, note: 'Excluded.' });
    outOfPocket += deliveryCost + prePostCost + newbornCost;
  } else {
    lineItems.push({ label: 'Delivery Charges', amount: deliveryCost, covered: true, note: 'Covered under maternity benefit.' });
    lineItems.push({ label: 'Pre/Post-natal Care', amount: prePostCost, covered: true, note: 'Covered.' });
    lineItems.push({ label: 'Newborn Care', amount: newbornCost, covered: true, note: 'Covered for first 91 days.' });
    covered += deliveryCost + prePostCost + newbornCost;
  }

  const relevantFlags = flags.filter(f => f.taxonomyId === 'R12' || f.taxonomyId === 'G04');

  const totalCost = deliveryCost + prePostCost + newbornCost;
  const narrative = excluded
    ? `Maternity and pregnancy-related expenses are excluded from this policy. The full cost of ${currency(totalCost)} would be out of pocket.`
    : `Maternity-related expenses of ${currency(totalCost)} are covered under your policy. This includes delivery, pre/post-natal care, and newborn care for the first 91 days.`;

  return {
    scenarioId: 'maternity',
    scenarioName: 'Maternity & Newborn',
    scenarioDescription: `Normal delivery including pre/post-natal care and newborn expenses, totaling ${currency(totalCost)}.`,
    estimatedTotalCost: totalCost,
    estimatedCovered: covered,
    estimatedOutOfPocket: outOfPocket,
    summary: `Covered: ${currency(covered)} | You pay: ${currency(outOfPocket)}`,
    narrative,
    lineItems,
    relevantFlags,
  };
}

export function simulateAccident(clauses: ExtractedClause[], flags: MatchResult['flags']): ScenarioResult {
  const sumInsured = getField(clauses, 'sum_insured') as number | undefined || 500000;
  const coPay = getField(clauses, 'co_pay.percentage') as number | undefined || 0;
  const accidentCost = 150000;

  const lineItems: ScenarioCostLineItem[] = [];
  let covered = 0;
  let outOfPocket = 0;

  // Usually accidents are covered even during initial waiting period
  lineItems.push({ label: 'Emergency Treatment (Accident)', amount: accidentCost, covered: true, note: 'Accident-related emergency treatment is covered from day 1, even during the initial waiting period.' });
  covered += accidentCost;

  if (coPay > 0) {
    const cpAmt = Math.round((covered * coPay) / 100);
    lineItems.push({ label: `Co-pay (${coPay}%)`, amount: cpAmt, covered: false, note: `${coPay}% of approved amount = ${currency(cpAmt)}.` });
    outOfPocket += cpAmt;
  }

  const relevantFlags = flags.filter(f => ['R03', 'R05'].includes(f.taxonomyId));

  const narrative = `In case of an accident, emergency treatment of ${currency(accidentCost)} is covered from day 1 of your policy. Total covered: ${currency(covered)}. You pay: ${currency(outOfPocket)}.`;

  return {
    scenarioId: 'accident',
    scenarioName: 'Accident & Emergency',
    scenarioDescription: `Emergency treatment after an accident, costing ${currency(accidentCost)}.`,
    estimatedTotalCost: accidentCost,
    estimatedCovered: covered,
    estimatedOutOfPocket: outOfPocket,
    summary: `Covered: ${currency(covered)} | You pay: ${currency(outOfPocket)}`,
    narrative,
    lineItems,
    relevantFlags,
  };
}

const SCENARIOS = {
  hospitalization: simulateHospitalization,
  'named-surgery': simulateNamedSurgery,
  'ped-claim': simulatePEDClaim,
  maternity: simulateMaternity,
  accident: simulateAccident,
};

export type ScenarioId = keyof typeof SCENARIOS;

export const SCENARIO_METADATA: Record<ScenarioId, { name: string; description: string }> = {
  hospitalization: { name: 'Planned Hospitalization', description: '5-day hospital stay with treatment' },
  'named-surgery': { name: 'Named Surgery (Cataract)', description: 'Routine cataract surgery' },
  'ped-claim': { name: 'Pre-existing Disease Claim', description: 'Claim for a pre-existing condition' },
  maternity: { name: 'Maternity & Newborn', description: 'Delivery and newborn care' },
  accident: { name: 'Accident & Emergency', description: 'Emergency accident treatment' },
};

export function simulateScenario(
  scenarioId: string,
  clauses: ExtractedClause[],
  flags: MatchResult['flags']
): ScenarioResult | null {
  const fn = SCENARIOS[scenarioId as ScenarioId];
  if (!fn) return null;
  return fn(clauses, flags);
}

export function simulateAllScenarios(
  clauses: ExtractedClause[],
  flags: MatchResult['flags']
): ScenarioResult[] {
  return Object.entries(SCENARIOS).map(([id, fn]) => fn(clauses, flags));
}