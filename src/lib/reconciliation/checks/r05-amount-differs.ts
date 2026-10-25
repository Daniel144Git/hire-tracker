import { expectedHireCharge } from "@/lib/charging/hire-charge";
import { round2 } from "@/lib/money";
import {
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
import type { Check } from "../types";

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
    const outsideHire =
      isBefore(period.from, order.startDate) ||
      (order.offHireDate !== null && isBefore(order.offHireDate, period.to));
    if (outsideHire) return [];

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
