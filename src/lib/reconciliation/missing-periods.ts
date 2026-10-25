import { addDays, endOfNextMonth, parseIsoDate, type IsoDate } from "@/lib/charging/iso-date";
import { countChargeableDays, type WorkingDayRules } from "@/lib/charging/working-days";

export interface OrderOnHire {
  id: string;
  supplierJobNo: string;
  siteCode: string;
  startDate: IsoDate;
  offHireDate: IsoDate | null;
}

export interface BilledPeriod {
  orderId: string;
  from: IsoDate;
  to: IsoDate;
}

export interface MissingPeriod {
  check: "R4";
  orderId: string;
  supplierJobNo: string;
  siteCode: string;
  from: IsoDate;
  to: IsoDate;
  workingDaysOnHire: number;
  message: string;
}

/** First and last day of a "YYYY-MM" month. */
export function monthRange(month: string): { from: IsoDate; to: IsoDate } {
  const from = `${month}-01`;
  // The day before the 1st is the last day of the previous month; the end of the month after
  // that is the last day of this month.
  return { from, to: endOfNextMonth(addDays(from, -1)) };
}

/**
 * R4: orders on hire for at least one working day of the month with no billed hire period
 * overlapping it: a possible late invoice, to plan for. A month is checked against the hire
 * lines of all invoices, not one invoice, so this runs for the monthly report.
 */
export function findMissingPeriods(
  month: string,
  orders: OrderOnHire[],
  billed: BilledPeriod[],
  rules: WorkingDayRules,
): MissingPeriod[] {
  const range = monthRange(month);
  return orders.flatMap((order) => {
    const from = later(range.from, order.startDate);
    const to = order.offHireDate ? earlier(range.to, order.offHireDate) : range.to;
    if (parseIsoDate(from) > parseIsoDate(to)) return [];
    const workingDaysOnHire = countChargeableDays(from, to, rules);
    if (workingDaysOnHire === 0) return [];

    const covered = billed.some(
      (period) =>
        period.orderId === order.id &&
        parseIsoDate(period.from) <= parseIsoDate(to) &&
        parseIsoDate(from) <= parseIsoDate(period.to),
    );
    if (covered) return [];
    return [
      {
        check: "R4" as const,
        orderId: order.id,
        supplierJobNo: order.supplierJobNo,
        siteCode: order.siteCode,
        from,
        to,
        workingDaysOnHire,
        message: `Job ${order.supplierJobNo} at ${order.siteCode} was on hire for ${workingDaysOnHire} working days in ${month} but no invoice covers it: possible late invoice`,
      },
    ];
  });
}

function later(a: IsoDate, b: IsoDate): IsoDate {
  return parseIsoDate(a) >= parseIsoDate(b) ? a : b;
}

function earlier(a: IsoDate, b: IsoDate): IsoDate {
  return parseIsoDate(a) <= parseIsoDate(b) ? a : b;
}
