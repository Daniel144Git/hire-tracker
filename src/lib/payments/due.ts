import { MS_PER_DAY, parseIsoDate, type IsoDate } from "@/lib/charging/iso-date";
import { fromPence, toPence } from "@/lib/money";

export interface PayableInvoice {
  id: string;
  number: string;
  supplierName: string;
  /** Sites of the orders on the invoice; the first one is the invoice's site. */
  siteCodes: string[];
  dueDate: IsoDate;
  gross: number;
  paymentStatus: "UNPAID" | "PAID" | "QUERIED" | "CREDITED";
  isCreditNote: boolean;
}

export type DueInvoice = PayableInvoice & {
  siteCode: string;
  /** Positive when overdue; 0 on the due date. */
  daysOverdue: number;
  daysUntilDue: number;
};

const UNASSIGNED = "Unassigned";

/**
 * Groups the invoices still to pay by when they are due, as of a date (brief 4.2a):
 * overdue, due within 7 days, within 8 to 14 days, and later. Queried invoices are on hold and
 * kept apart; paid and credited invoices and credit notes are left out. Totals are in pence.
 */
export function groupInvoicesByDueDate(invoices: PayableInvoice[], asOf: IsoDate) {
  const open = invoices
    .filter((invoice) => !invoice.isCreditNote)
    .filter((invoice) => invoice.paymentStatus === "UNPAID" || invoice.paymentStatus === "QUERIED")
    .map((invoice): DueInvoice => {
      const daysUntilDue = (parseIsoDate(invoice.dueDate) - parseIsoDate(asOf)) / MS_PER_DAY;
      return {
        ...invoice,
        siteCode: invoice.siteCodes[0] ?? UNASSIGNED,
        daysUntilDue,
        daysOverdue: Math.max(0, -daysUntilDue),
      };
    })
    .sort(
      (a, b) =>
        parseIsoDate(a.dueDate) - parseIsoDate(b.dueDate) || a.number.localeCompare(b.number),
    );

  const toPay = open.filter((invoice) => invoice.paymentStatus === "UNPAID");
  const groups = {
    overdue: toPay.filter((i) => i.daysUntilDue < 0),
    dueIn7Days: toPay.filter((i) => i.daysUntilDue >= 0 && i.daysUntilDue <= 7),
    dueIn14Days: toPay.filter((i) => i.daysUntilDue > 7 && i.daysUntilDue <= 14),
    later: toPay.filter((i) => i.daysUntilDue > 14),
    queried: open.filter((invoice) => invoice.paymentStatus === "QUERIED"),
  };

  const total = (list: DueInvoice[]) =>
    fromPence(list.reduce((sum, invoice) => sum + toPence(invoice.gross), 0));

  const siteCodes = [...new Set(toPay.map((invoice) => invoice.siteCode))].sort();
  return {
    ...groups,
    totals: {
      overdue: total(groups.overdue),
      dueIn7Days: total(groups.dueIn7Days),
      dueIn14Days: total(groups.dueIn14Days),
      later: total(groups.later),
      outstanding: total(toPay),
      queried: total(groups.queried),
    },
    bySite: siteCodes.map((siteCode) => ({
      siteCode,
      outstanding: total(toPay.filter((i) => i.siteCode === siteCode)),
      overdue: total(groups.overdue.filter((i) => i.siteCode === siteCode)),
    })),
  };
}

export type DueGroups = ReturnType<typeof groupInvoicesByDueDate>;
