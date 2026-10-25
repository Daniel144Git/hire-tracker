import { addDays, parseIsoDate, type IsoDate } from "@/lib/charging/iso-date";
import { round2, toPence } from "@/lib/money";
import type {
  CheckId,
  CheckInvoice,
  CheckLine,
  CheckOrder,
  Finding,
  ReconciliationContext,
  Severity,
} from "./types";

/** "£1,234.50", or "-£39.60" for a credit. */
export function money(amount: number): string {
  const formatted = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    Math.abs(amount),
  );
  return amount < 0 ? `-${formatted}` : formatted;
}

/** "1 working day", "13 working days". */
export function workingDays(count: number): string {
  return `${count} working ${count === 1 ? "day" : "days"}`;
}

/** "4 wks 1 day", as printed on invoices. */
export function weeksAndDays(weeks: number, days: number): string {
  return `${weeks} wks ${days} ${days === 1 ? "day" : "days"}`;
}

/** True when |a - b| is more than the tolerance, compared in whole pence (no float noise). */
export function differsBeyond(a: number, b: number, tolerance: number): boolean {
  return Math.abs(toPence(round2(a)) - toPence(round2(b))) > toPence(round2(tolerance));
}

/** A hire charge (not a credit) on a hire line. */
export function isHireCharge(line: CheckLine): boolean {
  return line.chargeType === "HIRE" && line.net > 0;
}

export function orderOf(context: ReconciliationContext, line: CheckLine): CheckOrder | undefined {
  return line.orderId ? context.orders[line.orderId] : undefined;
}

export function weeklyRateOf(context: ReconciliationContext, line: CheckLine): number | undefined {
  return orderOf(context, line)?.items.find((item) => item.id === line.hireItemId)?.weeklyRate;
}

/** The billing period with its ends in order: credit notes can print it backwards. */
export function periodOf(line: CheckLine): { from: IsoDate; to: IsoDate } | undefined {
  if (!line.periodFrom || !line.periodTo) return undefined;
  const [from, to] =
    parseIsoDate(line.periodFrom) <= parseIsoDate(line.periodTo)
      ? [line.periodFrom, line.periodTo]
      : [line.periodTo, line.periodFrom];
  return { from, to };
}

export function isBefore(a: IsoDate, b: IsoDate): boolean {
  return parseIsoDate(a) < parseIsoDate(b);
}

export function dayAfter(date: IsoDate): IsoDate {
  return addDays(date, 1);
}

export function dayBefore(date: IsoDate): IsoDate {
  return addDays(date, -1);
}

/** Builds a finding with the money fields rounded to the penny. */
export function finding(
  check: CheckId,
  severity: Severity,
  invoiceLineId: string | null,
  message: string,
  amounts: { billed?: number | null; expected?: number | null; difference?: number | null } = {},
): Finding {
  const pennies = (value: number | null | undefined) =>
    value === null || value === undefined ? null : round2(value);
  return {
    check,
    severity,
    invoiceLineId,
    message,
    billed: pennies(amounts.billed),
    expected: pennies(amounts.expected),
    difference: pennies(amounts.difference),
    resolved: false,
    resolution: null,
  };
}

/** The earlier of two invoices: by date, then by number. */
export function isEarlier(a: CheckInvoice, b: CheckInvoice): boolean {
  return a.date === b.date ? a.number < b.number : isBefore(a.date, b.date);
}

/** The most recent invoice before this one that matches, or undefined. */
export function previousInvoice(
  context: ReconciliationContext,
  matches: (invoice: CheckInvoice) => boolean,
): CheckInvoice | undefined {
  return context.otherInvoices
    .filter((other) => !other.isCreditNote && isEarlier(other, context.invoice) && matches(other))
    .sort((a, b) => (isEarlier(a, b) ? 1 : -1))[0];
}

/** The order of the invoice's job number. */
export function jobOrderOf(context: ReconciliationContext): CheckOrder | undefined {
  const { jobNo } = context.invoice;
  return jobNo ? Object.values(context.orders).find((o) => o.supplierJobNo === jobNo) : undefined;
}
