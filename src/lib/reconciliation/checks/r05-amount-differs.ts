import { expectedHireCharge, type ChargingRules } from "@/lib/charging/hire-charge";
import type { IsoDate } from "@/lib/charging/iso-date";
import { countChargeableDays } from "@/lib/charging/working-days";
import { round2 } from "@/lib/money";
import {
  dayAfter,
  dayBefore,
  differsBeyond,
  finding,
  isBefore,
  isHireCharge,
  money,
  orderOf,
  periodOf,
  weeklyRateOf,
  weeksAndDays,
} from "../helpers";
import type { Check, CheckOrder } from "../types";

/**
 * R5: a hire line whose amount differs from the agreed rate x chargeable units by more than
 * the tolerance. Lines billed outside the hire are left to R1 and R2, so a single mistake is
 * not reported twice. An undercharge is reported too, as LOW.
 */
export const amountDiffersFromExpected: Check = (context) =>
  context.invoice.lines.filter(isHireCharge).flatMap((line) => {
    const order = orderOf(context, line);
    const period = periodOf(line);
    const weeklyRate = weeklyRateOf(context, line);
    if (!order || !period || weeklyRate === undefined) return [];
    if (hasChargeableDaysOutsideHire(period, order, context.rules)) return [];

    const expected = expectedHireCharge({
      weeklyRate,
      qty: line.qty,
      period,
      hire: { start: order.startDate, offHire: order.offHireDate ?? undefined },
      rules: context.rules,
    });
    if (!differsBeyond(line.net, expected.total, context.tolerance)) return [];

    const difference = round2(line.net - expected.total);
    const quantity = line.qty > 1 ? `${line.qty} x ` : "";
    return [
      finding(
        "R5",
        difference > 0 ? "MEDIUM" : "LOW",
        line.id,
        `Billed ${money(line.net)}, expected ${money(expected.total)} for ${quantity}${weeksAndDays(expected.weeks, expected.days)} at ${money(weeklyRate)}/week`,
        { billed: line.net, expected: expected.total, difference },
      ),
    ];
  });

/** True when R1 or R2 reports this period: chargeable days before the start or after off-hire. */
function hasChargeableDaysOutsideHire(
  period: { from: IsoDate; to: IsoDate },
  order: CheckOrder,
  rules: ChargingRules,
): boolean {
  const before =
    isBefore(period.from, order.startDate) &&
    countChargeableDays(
      period.from,
      isBefore(period.to, order.startDate) ? period.to : dayBefore(order.startDate),
      rules,
    ) > 0;
  const after =
    order.offHireDate !== null &&
    isBefore(order.offHireDate, period.to) &&
    countChargeableDays(
      isBefore(period.from, dayAfter(order.offHireDate))
        ? dayAfter(order.offHireDate)
        : period.from,
      period.to,
      rules,
    ) > 0;
  return before || after;
}
