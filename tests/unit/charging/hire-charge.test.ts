import { describe, expect, it } from "vitest";
import {
  expectedHireCharge,
  splitWeeksAndDays,
  type ChargingRules,
  type HireChargeInput,
} from "@/lib/charging/hire-charge";

const rules: ChargingRules = {
  chargeBankHolidays: true,
  bankHolidays: ["2026-08-31"],
  minChargeDays: 5,
};

const AUGUST_2026 = { from: "2026-08-01", to: "2026-08-31" };

/** Builds a valid input; each test overrides only what it is about. */
function input(overrides: Partial<HireChargeInput> = {}): HireChargeInput {
  return {
    weeklyRate: 50,
    qty: 1,
    period: AUGUST_2026,
    hire: { start: "2026-07-01" },
    rules,
    ...overrides,
  };
}

describe("splitWeeksAndDays: prints a period as 'N wks M days'", () => {
  it.each([
    [21, 4, 1],
    [13, 2, 3],
    [5, 1, 0],
    [4, 0, 4],
    [0, 0, 0],
  ])("%i working days is %i wks %i days", (workingDays, weeks, days) => {
    expect(splitWeeksAndDays(workingDays)).toEqual({ weeks, days });
  });
});

describe("expectedHireCharge: working-day weekly rate", () => {
  describe("worked examples from the brief, rate £50.00/week", () => {
    it("charges a full continuation month, 1 Aug to 31 Aug 2026, as 4 wks 1 day = £210.00", () => {
      expect(expectedHireCharge(input())).toEqual({
        chargeableDays: 21,
        weeks: 4,
        days: 1,
        unitCharge: 210,
        total: 210,
      });
    });

    it("charges from a delivery on Thu 13 Aug to 31 Aug as 2 wks 3 days = £130.00", () => {
      const charge = expectedHireCharge(
        input({ period: { from: "2026-08-13", to: "2026-08-31" }, hire: { start: "2026-08-13" } }),
      );
      expect(charge).toMatchObject({ chargeableDays: 13, weeks: 2, days: 3, total: 130 });
    });
  });

  describe("the period is limited to the days the item was on hire", () => {
    it("does not charge days before the start of hire, even if the invoice period starts earlier", () => {
      const charge = expectedHireCharge(input({ hire: { start: "2026-08-13" } }));
      expect(charge).toMatchObject({ chargeableDays: 13, total: 130 });
    });

    it("stops charging at the off-hire date: off-hired Wed 12 Aug is 1 wk 3 days = £80.00", () => {
      const charge = expectedHireCharge(
        input({ hire: { start: "2026-07-01", offHire: "2026-08-12" } }),
      );
      expect(charge).toMatchObject({ chargeableDays: 8, weeks: 1, days: 3, total: 80 });
    });

    it("charges up to Friday when the item is off-hired on Sat 15 Aug", () => {
      const charge = expectedHireCharge(
        input({ hire: { start: "2026-07-01", offHire: "2026-08-15" } }),
      );
      expect(charge).toMatchObject({ chargeableDays: 10, total: 100 });
    });

    it("charges nothing for a period that starts after the off-hire date", () => {
      const charge = expectedHireCharge(
        input({
          period: { from: "2026-09-01", to: "2026-09-30" },
          hire: { start: "2026-07-01", offHire: "2026-08-12" },
        }),
      );
      expect(charge).toEqual({ chargeableDays: 0, weeks: 0, days: 0, unitCharge: 0, total: 0 });
    });
  });

  describe("minimum charge of one week on a new hire", () => {
    it("charges a full week when an item is delivered and returned within 3 working days", () => {
      const charge = expectedHireCharge(
        input({ hire: { start: "2026-08-04", offHire: "2026-08-06" } }),
      );
      expect(charge).toMatchObject({ chargeableDays: 5, weeks: 1, days: 0, total: 50 });
    });

    it("does not add anything when the hire lasted exactly 5 working days", () => {
      const charge = expectedHireCharge(
        input({ hire: { start: "2026-08-03", offHire: "2026-08-07" } }),
      );
      expect(charge).toMatchObject({ chargeableDays: 5, total: 50 });
    });

    it("charges pro-rata after the first week: 7 working days is 1 wk 2 days = £70.00", () => {
      const charge = expectedHireCharge(
        input({ hire: { start: "2026-08-03", offHire: "2026-08-11" } }),
      );
      expect(charge).toMatchObject({ chargeableDays: 7, weeks: 1, days: 2, total: 70 });
    });

    it("adds the missing days to the off-hire period when a short hire crosses a month end", () => {
      // On hire Thu 30 Jul to Tue 4 Aug: 4 working days in total, so 1 day is added.
      const hire = { start: "2026-07-30", offHire: "2026-08-04" };
      const july = expectedHireCharge(
        input({ period: { from: "2026-07-01", to: "2026-07-31" }, hire }),
      );
      const august = expectedHireCharge(input({ hire }));

      expect(july).toMatchObject({ chargeableDays: 2, total: 20 });
      expect(august).toMatchObject({ chargeableDays: 3, total: 30 });
      expect(july.total + august.total).toBe(50);
    });

    it("does not apply the minimum while the item is still on hire", () => {
      const charge = expectedHireCharge(
        input({ period: { from: "2026-08-01", to: "2026-08-04" }, hire: { start: "2026-08-03" } }),
      );
      expect(charge).toMatchObject({ chargeableDays: 2, total: 20 });
    });
  });

  describe("bank holidays", () => {
    it("charges 4 wks = £200.00 for August when the supplier does not charge Mon 31 Aug", () => {
      const charge = expectedHireCharge(input({ rules: { ...rules, chargeBankHolidays: false } }));
      expect(charge).toMatchObject({ chargeableDays: 20, weeks: 4, days: 0, total: 200 });
    });
  });

  describe("rounding to the penny", () => {
    it("rounds one day of a £41.29 weekly rate (£8.258) to £8.26", () => {
      const charge = expectedHireCharge(
        input({ weeklyRate: 41.29, hire: { start: "2026-08-31" } }),
      );
      expect(charge).toMatchObject({ chargeableDays: 1, total: 8.26 });
    });

    it("rounds once per line, not once per day: 3 days at £41.29/week is £24.77, not 3 x £8.26", () => {
      const charge = expectedHireCharge(
        input({ weeklyRate: 41.29, period: { from: "2026-08-03", to: "2026-08-05" } }),
      );
      expect(charge).toMatchObject({ chargeableDays: 3, total: 24.77 });
    });

    it("charges 1 wk 2 days at £41.29/week as £57.81", () => {
      const charge = expectedHireCharge(
        input({ weeklyRate: 41.29, period: { from: "2026-08-03", to: "2026-08-11" } }),
      );
      expect(charge).toMatchObject({ chargeableDays: 7, total: 57.81 });
    });

    it("charges an adaptor at £3.75/week for August as £15.75", () => {
      expect(expectedHireCharge(input({ weeklyRate: 3.75 })).total).toBe(15.75);
    });
  });

  describe("quantity", () => {
    it("charges 4 identical scissor lifts as 4 x £210.00 = £840.00", () => {
      expect(expectedHireCharge(input({ qty: 4 }))).toMatchObject({ unitCharge: 210, total: 840 });
    });

    it("multiplies the rounded line charge: 3 x £8.26 = £24.78", () => {
      const charge = expectedHireCharge(
        input({ weeklyRate: 41.29, qty: 3, hire: { start: "2026-08-31" } }),
      );
      expect(charge).toMatchObject({ unitCharge: 8.26, total: 24.78 });
    });
  });

  describe("invalid input", () => {
    it("rejects a negative weekly rate", () => {
      expect(() => expectedHireCharge(input({ weeklyRate: -50 }))).toThrow(RangeError);
    });

    it.each([0, -1, 1.5])("rejects a quantity of %s", (qty) => {
      expect(() => expectedHireCharge(input({ qty }))).toThrow(RangeError);
    });

    it("rejects an off-hire date before the start of hire", () => {
      expect(() =>
        expectedHireCharge(input({ hire: { start: "2026-08-10", offHire: "2026-08-05" } })),
      ).toThrow(RangeError);
    });

    it("rejects a billing period that ends before it starts", () => {
      expect(() =>
        expectedHireCharge(input({ period: { from: "2026-08-31", to: "2026-08-01" } })),
      ).toThrow(RangeError);
    });
  });
});
