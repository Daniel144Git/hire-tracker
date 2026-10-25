import { splitWeeksAndDays, WORKING_DAYS_PER_WEEK } from "@/lib/charging/hire-charge";
import { countChargeableDays } from "@/lib/charging/working-days";
import { round2 } from "@/lib/money";
import { differsBeyond, finding, isEarlier, isHireCharge, money, periodOf } from "../helpers";
import type { Check, CheckLine, ReconciliationContext } from "../types";

/**
 * The weekly rate a line was billed at: net x 5 / (working days x qty). Undefined for periods
 * shorter than a week, where the one-week minimum distorts it.
 */
function billedWeeklyRate(line: CheckLine, context: ReconciliationContext): number | undefined {
  const period = periodOf(line);
  if (!period) return undefined;
  const days = countChargeableDays(period.from, period.to, context.rules);
  if (days < WORKING_DAYS_PER_WEEK) return undefined;
  return round2((line.net * WORKING_DAYS_PER_WEEK) / (days * line.qty));
}

/**
 * The previous billing of the same item and its rate, when this line's weekly rate differs
 * from it beyond the tolerance. Shared with R5, which leaves such lines to R6.
 */
export function rateChange(context: ReconciliationContext, line: CheckLine) {
  if (!isHireCharge(line) || !line.hireItemId) return undefined;
  const rate = billedWeeklyRate(line, context);
  if (rate === undefined) return undefined;

  const previous = context.otherInvoices
    .filter((other) => !other.isCreditNote && isEarlier(other, context.invoice))
    .flatMap((other) =>
      other.lines
        .filter((l) => isHireCharge(l) && l.hireItemId === line.hireItemId)
        .map((l) => ({ invoice: other, rate: billedWeeklyRate(l, context) })),
    )
    .filter(
      (billing): billing is { invoice: typeof billing.invoice; rate: number } =>
        billing.rate !== undefined,
    )
    .sort((a, b) => (isEarlier(a.invoice, b.invoice) ? 1 : -1))[0];

  if (!previous || !differsBeyond(rate, previous.rate, context.tolerance)) return undefined;
  return { rate, previousRate: previous.rate, previousNumber: previous.invoice.number };
}

/**
 * R6: an item billed at a different weekly rate than on its previous billing. Comparing weekly
 * rates (not amounts) makes months with different numbers of working days comparable.
 */
export const rateDrift: Check = (context) =>
  context.invoice.lines.flatMap((line) => {
    const change = rateChange(context, line);
    const period = periodOf(line);
    if (!change || !period) return [];

    const { weeks, days } = splitWeeksAndDays(
      countChargeableDays(period.from, period.to, context.rules),
    );
    const atPreviousRate = round2(
      round2(weeks * change.previousRate + days * (change.previousRate / WORKING_DAYS_PER_WEEK)) *
        line.qty,
    );
    return [
      finding(
        "R6",
        "MEDIUM",
        line.id,
        `Billed at ${money(change.rate)}/week, but ${money(change.previousRate)}/week on ${change.previousNumber}: a rate change nobody agreed?`,
        { billed: line.net, expected: atPreviousRate, difference: line.net - atPreviousRate },
      ),
    ];
  });
