import { expectedHireCharge } from "@/lib/charging/hire-charge";
import { countChargeableDays } from "@/lib/charging/working-days";
import { round2 } from "@/lib/money";
import {
  dayAfter,
  finding,
  isBefore,
  isHireCharge,
  orderOf,
  periodOf,
  weeklyRateOf,
  workingDays,
} from "../helpers";
import type { Check, Finding, ReconciliationContext } from "../types";

/**
 * R1: a hire line billed past the order's off-hire date. The overcharge is what was billed
 * minus what the days on hire should cost. It is closed when credit notes for the same item
 * credit at least that amount (the supplier often bills the whole month, then credits).
 */
export const billedAfterOffHire: Check = (context) => {
  if (context.invoice.isCreditNote) return [];
  const findings: Finding[] = [];

  for (const line of context.invoice.lines.filter(isHireCharge)) {
    const order = orderOf(context, line);
    const period = periodOf(line);
    if (!order?.offHireDate || !period || !isBefore(order.offHireDate, period.to)) continue;

    const firstDayAfter = isBefore(period.from, dayAfter(order.offHireDate))
      ? dayAfter(order.offHireDate)
      : period.from;
    const daysAfter = countChargeableDays(firstDayAfter, period.to, context.rules);
    if (daysAfter === 0) continue;

    const weeklyRate = weeklyRateOf(context, line);
    const expected =
      weeklyRate === undefined
        ? null
        : expectedHireCharge({
            weeklyRate,
            qty: line.qty,
            period,
            // Cut the period at the off-hire date only: days billed before the start of hire
            // are R2's part of the overcharge, so the two never count the same pounds.
            hire: {
              start: isBefore(period.from, order.startDate) ? period.from : order.startDate,
              offHire: order.offHireDate,
            },
            rules: context.rules,
          }).total;
    const difference = expected === null ? null : round2(line.net - expected);

    const result = finding(
      "R1",
      "HIGH",
      line.id,
      `Job ${order.supplierJobNo} was off-hired on ${order.offHireDate} but billed to ${period.to}: ${workingDays(daysAfter)} charged after off-hire`,
      { billed: line.net, expected, difference },
    );
    findings.push(withCredits(result, line.hireItemId, context));
  }
  return findings;
};

/** Marks the finding resolved when credit notes for the same item cover the overcharge. */
function withCredits(
  result: Finding,
  hireItemId: string | null,
  context: ReconciliationContext,
): Finding {
  if (result.difference === null || hireItemId === null) return result;
  const credits = context.otherInvoices
    .filter((invoice) => invoice.isCreditNote)
    .map((invoice) => ({
      number: invoice.number,
      amount: -invoice.lines
        .filter((l) => l.chargeType === "HIRE" && l.hireItemId === hireItemId && l.net < 0)
        .reduce((sum, l) => sum + l.net, 0),
    }))
    .filter((credit) => credit.amount > 0);
  const credited = round2(credits.reduce((sum, credit) => sum + credit.amount, 0));
  if (credits.length === 0 || credited < round2(result.difference - context.tolerance)) {
    return result;
  }
  return {
    ...result,
    resolved: true,
    resolution: `Credited on ${credits.map((credit) => credit.number).join(", ")}`,
  };
}
