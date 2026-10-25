import { addDays } from "@/lib/charging/iso-date";
import { finding, money, orderOf } from "../helpers";
import type { Check } from "../types";

/** How far before the invoice an event can be, and how late it can be recorded after it. */
const DAYS_BEFORE = 60;
const DAYS_AFTER = 7;

const sameCode = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

/**
 * R9: a charge for damage, loss, repair or service (an OTHER line) must match something the
 * site recorded: an event on the same site, from 60 days before the invoice to 7 days after it,
 * and for the same item when both give a fleet code. Credits are not checked.
 */
export const chargeWithoutEvent: Check = (context) => {
  const { invoice } = context;
  if (invoice.isCreditNote) return [];
  const from = addDays(invoice.date, -DAYS_BEFORE);
  const to = addDays(invoice.date, DAYS_AFTER);

  return invoice.lines
    .filter((line) => line.chargeType === "OTHER" && line.net > 0)
    .flatMap((line) => {
      const order = orderOf(context, line);
      const siteId = order?.site.id ?? invoice.siteId ?? null;
      const siteCode = order?.site.code ?? invoice.siteCode ?? "the site";
      const what = `${line.description} charged at ${money(line.net)}, but`;
      if (siteId === null) {
        return [
          // Our records' gap, not the supplier's: low, and left out of query emails.
          finding(
            "R9",
            "LOW",
            line.id,
            `${what} the site is not known, so no service, repair, damage or loss can be matched: link the invoice to a site`,
            { billed: line.net },
          ),
        ];
      }
      const matched = context.serviceEvents.some(
        (event) =>
          event.siteId === siteId &&
          event.date >= from &&
          event.date <= to &&
          (!event.fleetCode || !line.fleetCode || sameCode(event.fleetCode, line.fleetCode)),
      );
      if (matched) return [];
      return [
        finding(
          "R9",
          "MEDIUM",
          line.id,
          `${what} no service, repair, damage or loss is recorded on ${siteCode} in the ${DAYS_BEFORE} days before the invoice: ask for the damage report or the site's confirmation`,
          { billed: line.net },
        ),
      ];
    });
};
