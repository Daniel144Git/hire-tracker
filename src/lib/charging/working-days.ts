import { dayOfWeek, MS_PER_DAY, parseIsoDate, type IsoDate } from "./iso-date";

export interface WorkingDayRules {
  /** True when the supplier charges bank holidays like any other working day. */
  chargeBankHolidays: boolean;
  /** Bank holidays as "YYYY-MM-DD". Only used when chargeBankHolidays is false. */
  bankHolidays: readonly IsoDate[];
}

const SUNDAY = 0;
const SATURDAY = 6;

/**
 * Number of chargeable working days from `from` to `to`, both inclusive.
 * Weekends are never charged. Bank holidays are charged unless the rules say otherwise.
 */
export function countChargeableDays(from: IsoDate, to: IsoDate, rules: WorkingDayRules): number {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (start > end) {
    throw new RangeError(`Invalid period: ${from} is after ${to}`);
  }

  const freeDays = rules.chargeBankHolidays
    ? new Set<number>()
    : new Set(rules.bankHolidays.map(parseIsoDate));

  let count = 0;
  for (let day = start; day <= end; day += MS_PER_DAY) {
    const weekday = dayOfWeek(day);
    const isWeekend = weekday === SATURDAY || weekday === SUNDAY;
    if (!isWeekend && !freeDays.has(day)) {
      count++;
    }
  }
  return count;
}
