import { addDays } from "@/lib/charging/iso-date";
import { differsBeyond, finding, isEarlier, isHireCharge, money, orderOf } from "../helpers";
import type { Check } from "../types";

/**
 * Orders started further apart than this are not compared: suppliers change their prices over
 * time, and long sites run for years. To be confirmed with real use.
 */
export const RATE_COMPARISON_DAYS = 183;

/** "  OUTRIGGER   adaptor " and "Outrigger adaptor" are the same item type. */
function itemType(description: string): string {
  return description.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * R12: the same product hired at different weekly rates on different orders of the supplier
 * (e.g. an adaptor at £3.50/week on one order and £3.75/week on another). Only comparable
 * items are compared: identified by a fleet code (E-code) on both sides, hired one at a time,
 * on orders started within six months of each other. Reported once per item, on the first
 * invoice that bills it. LOW: worth a look, not necessarily wrong.
 */
export const rateInconsistency: Check = (context) =>
  context.invoice.lines.filter(isHireCharge).flatMap((line) => {
    const order = orderOf(context, line);
    const item = order?.items.find((i) => i.id === line.hireItemId);
    if (!order || !item || !item.fleetCode || line.qty > 1 || (item.qty ?? 1) > 1) return [];

    const billedBefore = context.otherInvoices.some(
      (other) =>
        !other.isCreditNote &&
        isEarlier(other, context.invoice) &&
        other.lines.some((l) => isHireCharge(l) && l.hireItemId === item.id),
    );
    if (billedBefore) return [];

    const from = addDays(order.startDate, -RATE_COMPARISON_DAYS);
    const to = addDays(order.startDate, RATE_COMPARISON_DAYS);
    const others = context.supplierItems.filter(
      (other) =>
        other.orderId !== order.id &&
        other.fleetCode !== null &&
        other.qty === 1 &&
        other.orderStartDate >= from &&
        other.orderStartDate <= to &&
        itemType(other.description) === itemType(item.description) &&
        differsBeyond(other.weeklyRate, item.weeklyRate, context.tolerance),
    );
    if (others.length === 0) return [];

    const elsewhere = others
      .map((other) => `${money(other.weeklyRate)}/week on job ${other.supplierJobNo}`)
      .join(", ");
    return [
      finding(
        "R12",
        "LOW",
        line.id,
        `${item.description} is hired at ${money(item.weeklyRate)}/week here but at ${elsewhere}`,
      ),
    ];
  });
