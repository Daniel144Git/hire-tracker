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
}

export interface CheckInvoice {
  id: string;
  number: string;
  date: IsoDate;
  type: "CONTINUATION" | "RETURN" | "SALE";
  isCreditNote: boolean;
  net: number;
  vat: number;
  gross: number;
  lines: CheckLine[];
}

export interface CheckOrder {
  id: string;
  supplierJobNo: string;
  startDate: IsoDate;
  offHireDate: IsoDate | null;
  damageWaiverApplies: boolean;
  items: { id: string; fleetCode: string | null; weeklyRate: number }[];
}

/** Everything a check may look at. Built from the database, but plain data, so checks are pure. */
export interface ReconciliationContext {
  /** The invoice being checked. */
  invoice: CheckInvoice;
  /** The hire orders its lines are linked to, by id. */
  orders: Record<string, CheckOrder>;
  /** Other invoices of the same supplier with lines on the same orders (history, credit notes). */
  otherInvoices: CheckInvoice[];
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
