import { formatIsoDate, parseIsoDate } from "@/lib/charging/iso-date";
import { WORKING_DAYS_PER_WEEK } from "@/lib/charging/hire-charge";
import { countChargeableDays } from "@/lib/charging/working-days";
import { finding, isEarlier, isHireCharge, periodOf, weeklyRateOf, workingDays } from "../helpers";
import type { Check } from "../types";

/**
 * R3: the same item billed for the same working days on an earlier invoice.
 * The amount at stake is the overlapping days at the agreed daily rate (weekly rate / 5).
 */
export const billedTwice: Check = (context) =>
  context.invoice.lines.filter(isHireCharge).flatMap((line) => {
    const period = periodOf(line);
    if (!period || !line.hireItemId) return [];

    const earlierBillings = context.otherInvoices
      // Only the later of two invoices is the duplicate.
      .filter((other) => !other.isCreditNote && isEarlier(other, context.invoice))
      .flatMap((other) =>
        other.lines
          .filter((l) => isHireCharge(l) && l.hireItemId === line.hireItemId)
          .map((l) => ({ invoice: other, period: periodOf(l) })),
      );

    return earlierBillings.flatMap(({ invoice, period: otherPeriod }) => {
      if (!otherPeriod) return [];
      const from = Math.max(parseIsoDate(period.from), parseIsoDate(otherPeriod.from));
      const to = Math.min(parseIsoDate(period.to), parseIsoDate(otherPeriod.to));
      if (from > to) return [];
      const overlap = { from: formatIsoDate(from), to: formatIsoDate(to) };
      const days = countChargeableDays(overlap.from, overlap.to, context.rules);
      if (days === 0) return [];

      const weeklyRate = weeklyRateOf(context, line);
      return [
        finding(
          "R3",
          "HIGH",
          line.id,
          `${overlap.from} to ${overlap.to} was already billed on ${invoice.number}: ${workingDays(days)} billed twice`,
          {
            billed: line.net,
            difference:
              weeklyRate === undefined
                ? null
                : (days * weeklyRate * line.qty) / WORKING_DAYS_PER_WEEK,
          },
        ),
      ];
    });
  });
