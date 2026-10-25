import { differsBeyond, finding, isHireCharge, money, orderOf } from "../helpers";
import type { Check } from "../types";

/** "  OUTRIGGER   adaptor " and "Outrigger adaptor" are the same item type. */
function itemType(description: string): string {
  return description.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * R12: the same item type hired at different weekly rates on different orders of the supplier
 * (e.g. an adaptor at £3.50/week on one order and £3.75/week on another). LOW: worth a look,
 * not necessarily wrong.
 */
export const rateInconsistency: Check = (context) =>
  context.invoice.lines.filter(isHireCharge).flatMap((line) => {
    const order = orderOf(context, line);
    const item = order?.items.find((i) => i.id === line.hireItemId);
    if (!order || !item) return [];

    const others = context.supplierItems.filter(
      (other) =>
        other.orderId !== order.id &&
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
