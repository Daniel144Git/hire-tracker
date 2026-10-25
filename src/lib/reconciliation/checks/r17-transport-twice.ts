import { finding, isEarlier } from "../helpers";
import type { Check, CheckLine } from "../types";

type TransportKind = "Collection" | "Delivery";

/**
 * "Tower Collection" is a collection, "Delivery to site" a delivery; anything else is not
 * compared. A supplement charged next to a delivery or collection is part of it, not a second
 * charge.
 */
function kindOf(line: CheckLine): TransportKind | undefined {
  if (line.chargeType !== "TRANSPORT" || line.net <= 0) return undefined;
  if (/supplement/i.test(line.description)) return undefined;
  if (/collect/i.test(line.description)) return "Collection";
  if (/deliver/i.test(line.description)) return "Delivery";
  return undefined;
}

/**
 * R17: a collection (or delivery) charged more than once for the same order on the same day
 * (or with no day printed), e.g. after a failed collection attempt. Only the later charge is
 * flagged.
 */
export const transportChargedTwice: Check = (context) => {
  const { invoice } = context;
  if (invoice.isCreditNote) return [];

  return invoice.lines.flatMap((line) => {
    const kind = kindOf(line);
    if (!kind || !line.orderId) return [];
    // The same trip: two trips with their days printed on different days are two trips.
    const sameDay = (l: CheckLine) =>
      !l.periodFrom || !line.periodFrom || l.periodFrom === line.periodFrom;
    const sameCharge = (l: CheckLine) =>
      kindOf(l) === kind && l.orderId === line.orderId && sameDay(l);

    const earlierOnThisInvoice = invoice.lines.find(
      (l) => l.position < line.position && sameCharge(l),
    );
    const earlierInvoice = context.otherInvoices.find(
      (other) => !other.isCreditNote && isEarlier(other, invoice) && other.lines.some(sameCharge),
    );
    const where = earlierOnThisInvoice
      ? `line ${earlierOnThisInvoice.position} of this invoice`
      : earlierInvoice?.number;
    if (!where) return [];

    const jobNo = context.orders[line.orderId]?.supplierJobNo ?? invoice.jobNo;
    return [
      finding(
        "R17",
        "MEDIUM",
        line.id,
        `${kind} charged more than once for job ${jobNo}: also on ${where}`,
        { billed: line.net, difference: line.net },
      ),
    ];
  });
};
