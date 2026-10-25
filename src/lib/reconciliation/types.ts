import type { ChargingRules } from "@/lib/charging/hire-charge";
import type { IsoDate } from "@/lib/charging/iso-date";
import type { ChargeType } from "@/lib/charging/damage-waiver";

export type CheckId =
  | "R1"
  | "R2"
  | "R3"
  | "R4"
  | "R5"
  | "R6"
  | "R7"
  | "R8"
  | "R9"
  | "R10"
  | "R11"
  | "R12"
  | "R13"
  | "R14"
  | "R15"
  | "R16"
  | "R17";

/** HIGH: money clearly overcharged. MEDIUM: an amount or rule to query. LOW: worth a look. */
export type Severity = "HIGH" | "MEDIUM" | "LOW";

/** One invoice line, as the checks see it. Amounts in pounds. */
export interface CheckLine {
  id: string;
  position: number;
  description: string;
  fleetCode: string | null;
  qty: number;
  periodFrom: IsoDate | null;
  periodTo: IsoDate | null;
  chargeType: ChargeType;
  net: number;
  vat: number;
  orderId: string | null;
  hireItemId: string | null;
  /** Why the line could not be linked when it was saved (Phase 3). */
  linkProblem:
    "UNKNOWN_ORDER_REF" | "UNKNOWN_JOB_NO" | "UNKNOWN_FLEET_CODE" | "AMBIGUOUS_FLEET_CODE" | null;
}

export interface CheckInvoice {
  id: string;
  number: string;
  date: IsoDate;
  type: "CONTINUATION" | "RETURN" | "SALE";
  isCreditNote: boolean;
  /** Job number printed in the header: one hire order. */
  jobNo: string | null;
  /** "Our ref" printed in the header: our own order number. */
  orderRef: string | null;
  /** "Last invoice" printed on the invoice: the previous invoice of the same job. */
  lastInvoiceNo: string | null;
  net: number;
  vat: number;
  gross: number;
  lines: CheckLine[];
}

export interface CheckOrder {
  id: string;
  supplierJobNo: string;
  site: { id: string; code: string };
  startDate: IsoDate;
  offHireDate: IsoDate | null;
  damageWaiverApplies: boolean;
  items: {
    id: string;
    description: string;
    fleetCode: string | null;
    weeklyRate: number;
    /** Codes the item had before a recorded change (E-code swap). */
    previousFleetCodes?: string[];
  }[];
}

/** An item on any hire order of the supplier, for comparing rates across orders (R12). */
export interface SupplierItem {
  orderId: string;
  supplierJobNo: string;
  description: string;
  weeklyRate: number;
}

/** A site suspension: free days the supplier must credit on every hire line of the period. */
export interface CheckSuspension {
  siteId: string;
  siteCode: string;
  periodFrom: IsoDate;
  periodTo: IsoDate;
  freeDays: number;
}

/** Everything a check may look at. Built from the database, but plain data, so checks are pure. */
export interface ReconciliationContext {
  /** The invoice being checked. */
  invoice: CheckInvoice;
  /** The hire orders its lines and its job number refer to, and those of related invoices, by id. */
  orders: Record<string, CheckOrder>;
  /**
   * Other invoices of the same supplier on the same orders or the same job number: history,
   * credit notes and return invoices.
   */
  otherInvoices: CheckInvoice[];
  /** Every item on the supplier's hire orders (R12). */
  supplierItems: SupplierItem[];
  /** Suspensions of the sites of these orders (R16). */
  suspensions: CheckSuspension[];
  rules: ChargingRules & { damageWaiverPct: number };
  /** Differences up to this amount (pounds) are ignored by R5, R6, R12 and R13. */
  tolerance: number;
  /** Standard VAT rate, e.g. 0.2. */
  vatRate: number;
}

export interface Finding {
  check: CheckId;
  severity: Severity;
  invoiceLineId: string | null;
  message: string;
  /** What was billed, what should have been billed, and billed - expected, in pounds. */
  billed: number | null;
  expected: number | null;
  difference: number | null;
  resolved: boolean;
  resolution: string | null;
}

export type Check = (context: ReconciliationContext) => Finding[];
