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
