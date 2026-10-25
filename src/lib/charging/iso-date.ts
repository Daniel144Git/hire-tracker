/** A calendar date as "YYYY-MM-DD", with no time and no time zone. */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Turns "YYYY-MM-DD" into a day number (milliseconds at UTC midnight).
 *
 * Everything works in UTC on purpose: a local-time Date can lose or gain an hour at a
 * daylight-saving change, and the same code would then count days differently on a laptop
 * in Romania and on a CI server in UTC.
 */
export function parseIsoDate(value: IsoDate): number {
  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new RangeError(`Invalid date "${value}": expected YYYY-MM-DD`);
  }
  const [, year, month, day] = match.map(Number);
  const time = Date.UTC(year, month - 1, day);
  const parsed = new Date(time);
  // Date.UTC silently rolls 2026-02-30 over to 2 March, so check nothing rolled over.
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid date "${value}": this day does not exist`);
  }
  return time;
}

/** Day of the week for a parsed date: 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(time: number): number {
  return new Date(time).getUTCDay();
}

/** A day number (UTC midnight) back to "YYYY-MM-DD". */
export function formatIsoDate(time: number): IsoDate {
  return new Date(time).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" plus a number of calendar days. */
export function addDays(date: IsoDate, days: number): IsoDate {
  return formatIsoDate(parseIsoDate(date) + days * MS_PER_DAY);
}

/** The last calendar day of the month after `date`, e.g. 2026-08-31 -> 2026-09-30. */
export function endOfNextMonth(date: IsoDate): IsoDate {
  const day = new Date(parseIsoDate(date));
  // Day 0 of a month is the last day of the month before it, so "month + 2, day 0" is
  // the last day of next month. Date.UTC also rolls December over into the next year.
  return formatIsoDate(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 2, 0));
}
