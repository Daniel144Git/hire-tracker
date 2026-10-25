import type { CHARGE_TYPES, INVOICE_TYPES } from "@/lib/schemas/invoice";
import type { PdfLine } from "./pdf-lines";

export type InvoiceType = (typeof INVOICE_TYPES)[number];
export type ChargeType = (typeof CHARGE_TYPES)[number];

/** A line as read from the PDF, in the shape the invoice form and API take. */
export interface DraftLine {
  description: string;
  fleetCode?: string;
  qty: number;
  periodFrom?: string;
  periodTo?: string;
  weeks?: number;
  days?: number;
  /** The weekly rate, on hire lines only. */
  rate?: number;
  chargeType: ChargeType;
  net: number;
  vat: number;
}

/**
 * An invoice as read from the PDF. Any field may be missing when it could not be read: the
 * person checking the invoice fills it in before it is saved.
 */
export interface InvoiceDraft {
  number?: string;
  date?: string;
  dueDate?: string;
  type?: InvoiceType;
  isCreditNote: boolean;
  jobNo?: string;
  orderRef?: string;
  lastInvoiceNo?: string;
  customerRef?: string;
  deliveryAddress?: string;
  net?: number;
  vat?: number;
  gross?: number;
  lines: DraftLine[];
}

export type LayoutId = "despatch" | "contract";

/** How to read one supplier document layout. */
export interface Layout {
  id: LayoutId;
  matches(lines: PdfLine[]): boolean;
  read(lines: PdfLine[]): { accountNo?: string; invoice: InvoiceDraft };
}

export interface Extraction {
  layout: LayoutId;
  /** Our account number with the supplier, as printed: it tells which supplier sent it. */
  accountNo?: string;
  invoice: InvoiceDraft;
  /** What a person should check before saving, e.g. totals that do not add up. */
  warnings: string[];
}
