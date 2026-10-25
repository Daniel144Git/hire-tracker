import { finding, isBefore, isHireCharge, orderOf } from "../helpers";
import type { Check } from "../types";

/**
 * R7: a continuation invoice for an order that already had a return invoice. Only a Return
 * invoice with hire lines ends a hire: the Return type is also used for loss charges.
 */
export const continuationAfterReturn: Check = (context) => {
  if (context.invoice.type !== "CONTINUATION") return [];
  const checkedOrders = new Set<string>();

  return context.invoice.lines.filter(isHireCharge).flatMap((line) => {
    const order = orderOf(context, line);
    if (!order || checkedOrders.has(order.id)) return [];
    checkedOrders.add(order.id);

    const returnInvoice = context.otherInvoices.find(
      (other) =>
        other.type === "RETURN" &&
        !other.isCreditNote &&
        isBefore(other.date, context.invoice.date) &&
        other.lines.some((l) => isHireCharge(l) && l.orderId === order.id),
    );
    if (!returnInvoice) return [];

    return [
      finding(
        "R7",
        "MEDIUM",
        line.id,
        `Continuation invoice for job ${order.supplierJobNo} after its return invoice ${returnInvoice.number} of ${returnInvoice.date}`,
        { billed: line.net },
      ),
    ];
  });
};
