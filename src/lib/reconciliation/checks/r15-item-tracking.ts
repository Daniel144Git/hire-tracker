import { finding, isBefore, isHireCharge, previousInvoice } from "../helpers";
import type { Check, CheckInvoice, Finding, ReconciliationContext } from "../types";

/**
 * The item a fleet code belongs to, through its current code or a recorded earlier one, so a
 * recorded E-code change keeps the same identity. A code on no item stands for itself.
 */
function identityOf(code: string, context: ReconciliationContext): string {
  for (const order of Object.values(context.orders)) {
    for (const item of order.items) {
      if (item.fleetCode === code || item.previousFleetCodes?.includes(code))
        return `item:${item.id}`;
    }
  }
  return `code:${code}`;
}

/** Identity -> one fleet code billed for it on the invoice, and the line. */
function billedItems(invoice: CheckInvoice, context: ReconciliationContext) {
  const items = new Map<string, { code: string; lineId: string }>();
  for (const line of invoice.lines.filter(isHireCharge)) {
    if (line.fleetCode)
      items.set(identityOf(line.fleetCode, context), { code: line.fleetCode, lineId: line.id });
  }
  return items;
}

/**
 * R15: item tracking month to month, per job number. Compares the items billed on this invoice
 * with the previous continuation invoice of the job:
 * - an item that is gone, with no return invoice and no off-hire: returned, lost, swapped?
 * - a new item on an existing job: an item swapped? (LOW)
 * - exactly one gone and one new: one possible swap, to confirm and record.
 * A recorded change of fleet code (E-code) is the same item, so it is not reported.
 * Every finding asks for confirmation on site: that is where the truth is.
 */
export const itemTracking: Check = (context) => {
  const { invoice } = context;
  if (invoice.isCreditNote || !invoice.jobNo) return [];
  const previous = previousInvoice(
    context,
    (other) => other.jobNo === invoice.jobNo && other.type === "CONTINUATION",
  );
  if (!previous) return [];

  const before = billedItems(previous, context);
  const now = billedItems(invoice, context);

  // A return invoice lists only the items that went back, so absences mean nothing there.
  const gone =
    invoice.type === "CONTINUATION"
      ? [...before].filter(([id, { code }]) => !now.has(id) && !leftSite(code, previous, context))
      : [];
  const added = [...now].filter(([id]) => !before.has(id));

  if (gone.length === 1 && added.length === 1) {
    const [, oldItem] = gone[0];
    const [, newItem] = added[0];
    return [
      finding(
        "R15",
        "MEDIUM",
        newItem.lineId,
        `${oldItem.code} (billed on ${previous.number}) is gone and ${newItem.code} is new on job ${invoice.jobNo}: the same item swapped? Confirm on site, then record the new code on the item`,
      ),
    ];
  }

  const findings: Finding[] = gone.map(([, { code }]) =>
    finding(
      "R15",
      "MEDIUM",
      null,
      `${code} was billed on ${previous.number} but is not on this invoice and has no return invoice: returned, lost or swapped? Confirm on site`,
    ),
  );
  for (const [, { code, lineId }] of added) {
    findings.push(
      finding(
        "R15",
        "LOW",
        lineId,
        `${code} is new on job ${invoice.jobNo} since ${previous.number}: item swapped? Check its rate and start date. Confirm on site`,
      ),
    );
  }
  return findings;
};

/** The item went back: its order was off-hired, or a return invoice after `previous` bills it. */
function leftSite(code: string, previous: CheckInvoice, context: ReconciliationContext): boolean {
  const offHired = Object.values(context.orders).some(
    (order) =>
      order.offHireDate !== null &&
      order.items.some(
        (item) => item.fleetCode === code || item.previousFleetCodes?.includes(code),
      ),
  );
  const returned = [...context.otherInvoices, context.invoice].some(
    (other) =>
      other.type === "RETURN" &&
      !other.isCreditNote &&
      isBefore(previous.date, other.date) &&
      other.lines.some((line) => line.fleetCode === code),
  );
  return offHired || returned;
}
