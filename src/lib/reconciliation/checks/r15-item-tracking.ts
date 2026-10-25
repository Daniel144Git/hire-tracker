import { finding, isBefore, isHireCharge, previousInvoice } from "../helpers";
import type { Check, CheckInvoice, Finding } from "../types";

function fleetCodes(invoice: CheckInvoice): Set<string> {
  return new Set(
    invoice.lines
      .filter((line) => isHireCharge(line) && line.fleetCode)
      .map((line) => line.fleetCode as string),
  );
}

/**
 * R15: item tracking month to month, per job number. Compares the fleet codes of this invoice
 * with the previous continuation invoice of the job:
 * - a fleet code that is gone, with no return invoice and no off-hire: returned, lost, swapped?
 * - a new fleet code on an existing job: an item swapped? (LOW)
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

  const before = fleetCodes(previous);
  const now = fleetCodes(invoice);
  const findings: Finding[] = [];

  // A return invoice lists only the items that went back, so absences mean nothing there.
  if (invoice.type === "CONTINUATION") {
    for (const code of before) {
      if (now.has(code) || leftSite(code, previous, context)) continue;
      findings.push(
        finding(
          "R15",
          "MEDIUM",
          null,
          `${code} was billed on ${previous.number} but is not on this invoice and has no return invoice: returned, lost or swapped? Confirm on site`,
        ),
      );
    }
  }

  for (const line of invoice.lines.filter(isHireCharge)) {
    if (!line.fleetCode || before.has(line.fleetCode)) continue;
    findings.push(
      finding(
        "R15",
        "LOW",
        line.id,
        `${line.fleetCode} is new on job ${invoice.jobNo} since ${previous.number}: item swapped? Check its rate and start date. Confirm on site`,
      ),
    );
  }
  return findings;
};

/** The item went back: its order was off-hired, or a return invoice after `previous` bills it. */
function leftSite(code: string, previous: CheckInvoice, context: Parameters<Check>[0]): boolean {
  const offHired = Object.values(context.orders).some(
    (order) => order.offHireDate !== null && order.items.some((item) => item.fleetCode === code),
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
