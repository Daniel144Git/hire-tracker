import { addDays, endOfNextMonth, type IsoDate } from "@/lib/charging/iso-date";

export interface PaymentTerms {
  paymentTerms: "END_OF_NEXT_MONTH" | "NET_N";
  paymentTermsDays?: number | null;
}

/**
 * When an invoice is due under the supplier's payment terms:
 * END_OF_NEXT_MONTH (default) is the last day of the month after the invoice date,
 * NET_N is N calendar days after it.
 */
export function calculateDueDate(invoiceDate: IsoDate, terms: PaymentTerms): IsoDate {
  if (terms.paymentTerms === "END_OF_NEXT_MONTH") {
    return endOfNextMonth(invoiceDate);
  }
  if (!terms.paymentTermsDays) {
    throw new RangeError("NET_N payment terms need a number of days");
  }
  return addDays(invoiceDate, terms.paymentTermsDays);
}
