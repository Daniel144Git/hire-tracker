import { expectedHireCharge } from "@/lib/charging/hire-charge";
import { countChargeableDays } from "@/lib/charging/working-days";
import { round2 } from "@/lib/money";
import {
  dayBefore,
  finding,
  isBefore,
  isHireCharge,
  orderOf,
  periodOf,
  weeklyRateOf,
  workingDays,
} from "../helpers";
import type { Check } from "../types";

/** R2: a hire line whose billing period starts before the order's start of hire. */
export const billedBeforeStart: Check = (context) =>
  context.invoice.lines.filter(isHireCharge).flatMap((line) => {
    const order = orderOf(context, line);
    const period = periodOf(line);
    if (!order || !period || !isBefore(period.from, order.startDate)) return [];

    const lastDayBefore = isBefore(period.to, order.startDate)
      ? period.to
      : dayBefore(order.startDate);
    const daysBefore = countChargeableDays(period.from, lastDayBefore, context.rules);
    if (daysBefore === 0) return [];

    const weeklyRate = weeklyRateOf(context, line);
    const expected =
      weeklyRate === undefined
        ? null
        : expectedHireCharge({
            weeklyRate,
            qty: line.qty,
            period,
            // Cut the period at the start of hire only: days after off-hire are R1's part.
            hire: { start: order.startDate },
            rules: context.rules,
          }).total;

    return [
      finding(
        "R2",
        "HIGH",
        line.id,
        `Job ${order.supplierJobNo} started on ${order.startDate} but was billed from ${period.from}: ${workingDays(daysBefore)} charged before the start of hire`,
        {
          billed: line.net,
          expected,
          difference: expected === null ? null : round2(line.net - expected),
        },
      ),
    ];
  });
