import { round2 } from "@/lib/money";
import { parseIsoDate, type IsoDate } from "./iso-date";
import { countChargeableDays, type WorkingDayRules } from "./working-days";

export const WORKING_DAYS_PER_WEEK = 5;

/** The supplier's charging profile (default: weekly rate over 5 working days). */
export interface ChargingRules extends WorkingDayRules {
  /** Minimum chargeable working days for a whole hire, e.g. 5 = one week. */
  minChargeDays: number;
}

export interface HireChargeInput {
  /** Agreed rate in pounds for one item for one week of 5 working days. */
  weeklyRate: number;
  /** Number of identical items on the line. */
  qty: number;
  /** Billing period printed on the invoice line. */
  period: { from: IsoDate; to: IsoDate };
  /** When the item went on hire and, once known, when it went off hire. */
  hire: { start: IsoDate; offHire?: IsoDate };
  rules: ChargingRules;
}

export interface HireCharge {
  chargeableDays: number;
  weeks: number;
  days: number;
  /** Charge for one item, rounded to the penny. */
  unitCharge: number;
  /** qty x unitCharge, rounded to the penny. */
  total: number;
}

/** 13 working days -> { weeks: 2, days: 3 }, printed on invoices as "2 wks 3 days". */
export function splitWeeksAndDays(workingDays: number): { weeks: number; days: number } {
  return {
    weeks: Math.floor(workingDays / WORKING_DAYS_PER_WEEK),
    days: workingDays % WORKING_DAYS_PER_WEEK,
  };
}

/**
 * What the supplier should charge for one invoice line, under the working-day weekly rate:
 * lineCharge = round2(weeks x rate + days x rate / 5), then x qty.
 *
 * Only the days the item was actually on hire are charged, so a period that starts before
 * the start of hire or runs past the off-hire date is cut down to the hire. The one-week
 * minimum applies to the whole hire: when a hire that lasted less than a week ends inside
 * this period, the missing days are added here, on the off-hire (return) invoice.
 */
export function expectedHireCharge(input: HireChargeInput): HireCharge {
  const { weeklyRate, qty, period, hire, rules } = input;
  validate(input);

  const from = later(period.from, hire.start);
  const to = hire.offHire ? earlier(period.to, hire.offHire) : period.to;
  let chargeableDays =
    parseIsoDate(from) <= parseIsoDate(to) ? countChargeableDays(from, to, rules) : 0;

  if (hire.offHire && isWithin(hire.offHire, period)) {
    const wholeHireDays = countChargeableDays(hire.start, hire.offHire, rules);
    chargeableDays += Math.max(0, rules.minChargeDays - wholeHireDays);
  }

  const { weeks, days } = splitWeeksAndDays(chargeableDays);
  const unitCharge = round2(weeks * weeklyRate + days * (weeklyRate / WORKING_DAYS_PER_WEEK));
  return { chargeableDays, weeks, days, unitCharge, total: round2(qty * unitCharge) };
}

function validate({ weeklyRate, qty, period, hire }: HireChargeInput): void {
  if (!Number.isFinite(weeklyRate) || weeklyRate < 0) {
    throw new RangeError(`Invalid weekly rate ${weeklyRate}: must be zero or more`);
  }
  if (!Number.isInteger(qty) || qty < 1) {
    throw new RangeError(`Invalid quantity ${qty}: must be a whole number of 1 or more`);
  }
  if (parseIsoDate(period.from) > parseIsoDate(period.to)) {
    throw new RangeError(`Invalid period: ${period.from} is after ${period.to}`);
  }
  if (hire.offHire && parseIsoDate(hire.offHire) < parseIsoDate(hire.start)) {
    throw new RangeError(`Invalid hire: off-hire ${hire.offHire} is before start ${hire.start}`);
  }
}

function later(a: IsoDate, b: IsoDate): IsoDate {
  return parseIsoDate(a) >= parseIsoDate(b) ? a : b;
}

function earlier(a: IsoDate, b: IsoDate): IsoDate {
  return parseIsoDate(a) <= parseIsoDate(b) ? a : b;
}

function isWithin(date: IsoDate, period: { from: IsoDate; to: IsoDate }): boolean {
  const day = parseIsoDate(date);
  return parseIsoDate(period.from) <= day && day <= parseIsoDate(period.to);
}
