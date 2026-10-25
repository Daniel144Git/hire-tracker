import { round2 } from "@/lib/money";

/** What an invoice line is for. DAMAGE_WAIVER is the waiver line itself. */
export type ChargeType = "HIRE" | "DAMAGE_WAIVER" | "TRANSPORT" | "SALE" | "OTHER";

export interface WaiverableLine {
  chargeType: ChargeType;
  /** Net amount of the line, already rounded to the penny. Negative on credit notes. */
  net: number;
  /** From the hire order: some plant categories carry no damage waiver. */
  damageWaiverApplies: boolean;
}

/**
 * The damage waiver line the supplier should put on an invoice: `percent` % of the hire
 * lines whose order carries damage waiver. Transport and other charges are left out.
 * The hire lines are added first and the result is rounded once, to the penny.
 */
export function expectedDamageWaiver(lines: readonly WaiverableLine[], percent: number): number {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new RangeError(`Invalid damage waiver ${percent}%: must be between 0 and 100`);
  }
  const hireTotal = lines
    .filter((line) => line.chargeType === "HIRE" && line.damageWaiverApplies)
    .reduce((sum, line) => sum + line.net, 0);
  return round2((hireTotal * percent) / 100);
}
