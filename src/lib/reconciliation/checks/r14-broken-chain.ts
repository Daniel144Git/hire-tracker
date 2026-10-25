import { finding, previousInvoice } from "../helpers";
import type { Check } from "../types";

/**
 * R14: the "last invoice" printed on an invoice must be the previous invoice we hold for the
 * same job number. Otherwise an invoice is missing from our records, or the order changed.
 */
export const brokenContinuationChain: Check = (context) => {
  const { invoice } = context;
  if (invoice.isCreditNote || !invoice.jobNo || !invoice.lastInvoiceNo) return [];

  const previous = previousInvoice(context, (other) => other.jobNo === invoice.jobNo);
  if (!previous) {
    return [
      finding(
        "R14",
        "MEDIUM",
        null,
        `Last invoice ${invoice.lastInvoiceNo} is not in Hire Tracker: ask the supplier for a copy`,
      ),
    ];
  }
  if (previous.number === invoice.lastInvoiceNo) return [];
  return [
    finding(
      "R14",
      "MEDIUM",
      null,
      `Last invoice printed is ${invoice.lastInvoiceNo}, but the previous invoice held for job ${invoice.jobNo} is ${previous.number}: an invoice may be missing`,
    ),
  ];
};
