export interface RupeeAtRiskInput {
  sumInsured?: number | null;
  claimAmount?: number;
  subLimitCap?: number | null;
  coPayPct?: number | null;
  roomRentExcessDays?: number;
  roomRentDailyCap?: number | null;
  nonNetworkReductionPct?: number | null;
}

export interface RupeeAtRiskResult {
  amount: number | null;
  components: Record<string, number>;
  missingFields: string[];
}

export function calculateRupeeAtRisk(input: RupeeAtRiskInput): RupeeAtRiskResult {
  const missingFields: string[] = [];
  const components: Record<string, number> = {};
  let total = 0;

  if (input.subLimitCap !== null && input.subLimitCap !== undefined) {
    if (input.sumInsured === null || input.sumInsured === undefined) {
      missingFields.push('sum_insured');
    } else if (input.claimAmount === null || input.claimAmount === undefined) {
      missingFields.push('claim_amount');
    } else {
      const exposure = input.claimAmount - input.subLimitCap;
      if (exposure > 0) {
        components.subLimitShortfall = exposure;
        total += exposure;
      }
    }
  }

  if (input.coPayPct !== null && input.coPayPct !== undefined) {
    if (input.claimAmount === null || input.claimAmount === undefined) {
      missingFields.push('claim_amount');
    } else {
      const exposure = Math.round((input.coPayPct / 100) * input.claimAmount);
      components.coPayOutOfPocket = exposure;
      total += exposure;
    }
  }

  if (input.roomRentDailyCap !== null && input.roomRentDailyCap !== undefined) {
    if (input.roomRentExcessDays === null || input.roomRentExcessDays === undefined) {
      missingFields.push('room_rent_excess_days');
    } else if (input.claimAmount === null || input.claimAmount === undefined) {
      missingFields.push('claim_amount');
    } else {
      const exposure = input.roomRentDailyCap * input.roomRentExcessDays;
      components.roomRentProportionateCut = exposure;
      total += exposure;
    }
  }

  if (input.nonNetworkReductionPct !== null && input.nonNetworkReductionPct !== undefined) {
    if (input.claimAmount === null || input.claimAmount === undefined) {
      missingFields.push('claim_amount');
    } else {
      const exposure = Math.round((input.nonNetworkReductionPct / 100) * input.claimAmount);
      components.nonNetworkReduction = exposure;
      total += exposure;
    }
  }

  if (missingFields.length > 0 && Object.keys(components).length === 0) {
    return { amount: null, components: {}, missingFields };
  }

  return { amount: total, components, missingFields };
}