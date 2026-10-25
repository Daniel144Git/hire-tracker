import { WORKING_DAYS_PER_WEEK } from "@/lib/charging/hire-charge";
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
} from "../helpers";
import type { Check } from "../types";

/**
 * R16: when a site was suspended, the supplier credits the free days as a negative sub-line
 * under every hire line of that period. Flags a missing credit (HIGH) or a wrong amount.
 */
export const suspensionCredit: Check = (context) => {
  const { invoice } = context;
  if (invoice.isCreditNote) return [];

  return invoice.lines.filter(isHireCharge).flatMap((line) => {
    const order = orderOf(context, line);
    const period = periodOf(line);
    const weeklyRate = weeklyRateOf(context, line);
    if (!order || !period || weeklyRate === undefined) return [];

    return context.suspensions
      .filter(
        (s) =>
          s.siteId === order.site.id &&
          !isBefore(s.periodTo, period.from) &&
          !isBefore(period.to, s.periodFrom),
      )
      .flatMap((suspension) => {
        const expected = -round2(
          ((suspension.freeDays * weeklyRate) / WORKING_DAYS_PER_WEEK) * line.qty,
        );
        const credit = invoice.lines.find(
          (l) => l.chargeType === "HIRE" && l.net < 0 && l.hireItemId === line.hireItemId,
        );
        const what = `${suspension.freeDays} free days`;
        if (!credit) {
          return [
            finding(
              "R16",
              "HIGH",
              line.id,
              `Site ${suspension.siteCode} was suspended from ${suspension.periodFrom} to ${suspension.periodTo} (${what}), but there is no suspension credit for this line`,
              { billed: 0, expected, difference: -expected },
            ),
          ];
        }
        if (!differsBeyond(credit.net, expected, context.tolerance)) return [];
        return [
          finding(
            "R16",
            "MEDIUM",
            credit.id,
            `Suspension credit ${money(credit.net)}, expected ${money(expected)} for ${what} at ${money(weeklyRate)}/week`,
            { billed: credit.net, expected, difference: credit.net - expected },
          ),
        ];
      });
  });
};
