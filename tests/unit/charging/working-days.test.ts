import { describe, expect, it } from "vitest";
import { countChargeableDays, type WorkingDayRules } from "@/lib/charging/working-days";

// England and Wales bank holidays used by these tests (source: gov.uk/bank-holidays).
const BANK_HOLIDAYS = [
  "2026-04-03", // Good Friday
  "2026-04-06", // Easter Monday
  "2026-08-31", // Summer bank holiday
  "2026-12-25", // Christmas Day
  "2026-12-28", // Boxing Day (substitute day)
  "2027-01-01", // New Year's Day
];

const bankHolidaysCharged: WorkingDayRules = {
  chargeBankHolidays: true,
  bankHolidays: BANK_HOLIDAYS,
};
const bankHolidaysFree: WorkingDayRules = {
  chargeBankHolidays: false,
  bankHolidays: BANK_HOLIDAYS,
};

describe("countChargeableDays: working days Mon-Fri in a period, both ends inclusive", () => {
  describe("worked examples from the brief", () => {
    it("counts 21 working days from Sat 1 Aug 2026 to Mon 31 Aug 2026", () => {
      expect(countChargeableDays("2026-08-01", "2026-08-31", bankHolidaysCharged)).toBe(21);
    });

    it("counts 13 working days from a delivery on Thu 13 Aug 2026 to Mon 31 Aug 2026", () => {
      expect(countChargeableDays("2026-08-13", "2026-08-31", bankHolidaysCharged)).toBe(13);
    });
  });

  describe("weekends", () => {
    it("counts 0 for a period that is only a weekend", () => {
      expect(countChargeableDays("2026-08-01", "2026-08-02", bankHolidaysCharged)).toBe(0);
    });

    it("counts 1 for a single weekday, because both ends are inclusive", () => {
      expect(countChargeableDays("2026-08-03", "2026-08-03", bankHolidaysCharged)).toBe(1);
    });

    it("stops at Friday when the period ends on a Saturday (off-hire on a weekend)", () => {
      expect(countChargeableDays("2026-08-01", "2026-08-15", bankHolidaysCharged)).toBe(10);
    });
  });

  describe("month and year boundaries", () => {
    it("counts a period crossing a month end: Mon 27 Jul to Fri 7 Aug 2026 is 10 days", () => {
      expect(countChargeableDays("2026-07-27", "2026-08-07", bankHolidaysCharged)).toBe(10);
    });

    it("counts 20 working days in February 2027 (28 days)", () => {
      expect(countChargeableDays("2027-02-01", "2027-02-28", bankHolidaysCharged)).toBe(20);
    });

    it("counts 21 working days in February 2028, including leap day Tue 29 Feb", () => {
      expect(countChargeableDays("2028-02-01", "2028-02-29", bankHolidaysCharged)).toBe(21);
    });

    it("counts a period crossing the year end: Mon 28 Dec 2026 to Fri 8 Jan 2027 is 10 days", () => {
      expect(countChargeableDays("2026-12-28", "2027-01-08", bankHolidaysCharged)).toBe(10);
    });
  });

  describe("bank-holiday flag", () => {
    it("charges bank holidays as working days when the supplier charges them", () => {
      expect(countChargeableDays("2026-04-01", "2026-04-30", bankHolidaysCharged)).toBe(22);
    });

    it("leaves out bank holidays on weekdays when the supplier does not charge them", () => {
      expect(countChargeableDays("2026-04-01", "2026-04-30", bankHolidaysFree)).toBe(20);
    });

    it("leaves out Mon 31 Aug 2026 from the August example when bank holidays are free", () => {
      expect(countChargeableDays("2026-08-01", "2026-08-31", bankHolidaysFree)).toBe(20);
    });

    it("leaves out both Boxing Day substitute and New Year's Day across the year end", () => {
      expect(countChargeableDays("2026-12-28", "2027-01-08", bankHolidaysFree)).toBe(8);
    });

    it("ignores a bank holiday that is outside the period", () => {
      expect(countChargeableDays("2026-08-03", "2026-08-07", bankHolidaysFree)).toBe(5);
    });
  });

  describe("invalid input", () => {
    it("rejects a period whose start is after its end", () => {
      expect(() => countChargeableDays("2026-08-31", "2026-08-01", bankHolidaysCharged)).toThrow(
        RangeError,
      );
    });

    it("rejects a date that does not exist, such as 30 February", () => {
      expect(() => countChargeableDays("2026-02-30", "2026-03-05", bankHolidaysCharged)).toThrow(
        RangeError,
      );
    });

    it("rejects a date that is not in YYYY-MM-DD format", () => {
      expect(() => countChargeableDays("31/08/2026", "2026-09-30", bankHolidaysCharged)).toThrow(
        RangeError,
      );
    });
  });
});
