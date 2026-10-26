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

interface BilledItem {
  code: string;
  lineId: string;
  /** "Pipe groover (APX-PG-0317)": how the item reads in a message. */
  label: string;
  /** The last day billed for it on the invoice. */
  periodTo: string | null;
}

/** Identity -> one fleet code billed for it on the invoice, and the line. */
function billedItems(invoice: CheckInvoice, context: ReconciliationContext) {
  const items = new Map<string, BilledItem>();
  for (const line of invoice.lines.filter(isHireCharge)) {
    if (!line.fleetCode) continue;
    items.set(identityOf(line.fleetCode, context), {
      code: line.fleetCode,
      lineId: line.id,
      label: `${line.description} (${line.fleetCode})`,
      periodTo: line.periodTo,
    });
  }
  return items;
}

/**
 * R15: item tracking month to month, per job number. Compares the items billed on this invoice
 * with the previous continuation invoice of the job:
 * - an item that is gone with no return recorded (see leftSite): returned, lost, swapped?
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
      ? [...before].filter(([id, item]) => !now.has(id) && !leftSite(item, previous, context))
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
        `${oldItem.label} on the previous invoice ${previous.number} is gone and ${newItem.label} is new on job ${invoice.jobNo}: the same item swapped? Confirm on site, then record the new code on the item`,
      ),
    ];
  }

  const findings: Finding[] = gone.map(([, { label }]) =>
    finding(
      "R15",
      "MEDIUM",
      null,
      `${label} was on the previous invoice of the job, ${previous.number}, but is not on this one, and no return is recorded for it: returned, lost or swapped? Confirm on site`,
    ),
  );
  for (const [, { label, lineId }] of added) {
    findings.push(
      finding(
        "R15",
        "LOW",
        lineId,
        `${label} is new on job ${invoice.jobNo} since the previous invoice ${previous.number}: item swapped? Check its rate and start date. Confirm on site`,
      ),
    );
  }
  return findings;
};

/**
 * The item went back, as the documents show it:
 * - its order was off-hired;
 * - a return after `previous` lists it: a return invoice, or a credit note of type Return (the
 *   supplier credits the days billed after the return);
 * - `previous` billed it to an earlier day than the other items, so it left during that period.
 */
function leftSite(
  item: BilledItem,
  previous: CheckInvoice,
  context: ReconciliationContext,
): boolean {
  const { code } = item;
  const offHired = Object.values(context.orders).some(
    (order) =>
      order.offHireDate !== null &&
      order.items.some((i) => i.fleetCode === code || i.previousFleetCodes?.includes(code)),
  );
  const returned = [...context.otherInvoices, context.invoice].some(
    (other) =>
      other.type === "RETURN" &&
      isBefore(previous.date, other.date) &&
      other.lines.some((line) => line.fleetCode === code),
  );
  const periodEnds = previous.lines
    .filter(isHireCharge)
    .map((line) => line.periodTo)
    .filter((day): day is string => day !== null);
  const lastDay = periodEnds.sort().at(-1);
  const endedEarly =
    item.periodTo !== null && lastDay !== undefined && isBefore(item.periodTo, lastDay);
  return offHired || returned || endedEarly;
}
