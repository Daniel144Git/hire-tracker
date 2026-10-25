import { describe, expect, it } from "vitest";
import { findMissingPeriods, type OrderOnHire } from "@/lib/reconciliation/missing-periods";

const rules = { chargeBankHolidays: true, bankHolidays: [] };
const onHireSinceJuly: OrderOnHire = {
  id: "order-1",
  supplierJobNo: "J100101",
  siteCode: "RVS",
  startDate: "2026-07-01",
  offHireDate: null,
};

describe("R4: a month on hire with no invoice", () => {
  it("reports an order on hire all of August with no billed period in August", () => {
    const julyBilled = [{ orderId: "order-1", from: "2026-07-01", to: "2026-07-31" }];

    expect(findMissingPeriods("2026-08", [onHireSinceJuly], julyBilled, rules)).toEqual([
      {
        check: "R4",
        orderId: "order-1",
        supplierJobNo: "J100101",
        siteCode: "RVS",
        from: "2026-08-01",
        to: "2026-08-31",
        workingDaysOnHire: 21,
        message:
          "Job J100101 at RVS was on hire for 21 working days in 2026-08 but no invoice covers it: possible late invoice",
      },
    ]);
  });

  it("does not report a month that is billed, even partly", () => {
    const partly = [{ orderId: "order-1", from: "2026-08-01", to: "2026-08-14" }];

    expect(findMissingPeriods("2026-08", [onHireSinceJuly], partly, rules)).toEqual([]);
  });

  it("counts only the days on hire in the month", () => {
    const offHired12Aug = { ...onHireSinceJuly, offHireDate: "2026-08-12" };

    const [gap] = findMissingPeriods("2026-08", [offHired12Aug], [], rules);

    expect(gap).toMatchObject({ from: "2026-08-01", to: "2026-08-12", workingDaysOnHire: 8 });
  });

  it("ignores orders that started after the month or were off-hired before it", () => {
    const later = { ...onHireSinceJuly, startDate: "2026-09-01" };
    const earlier = { ...onHireSinceJuly, offHireDate: "2026-07-20" };

    expect(findMissingPeriods("2026-08", [later, earlier], [], rules)).toEqual([]);
  });

  it("ignores an order on hire only over a weekend of the month", () => {
    const weekendOnly = { ...onHireSinceJuly, startDate: "2026-08-29", offHireDate: "2026-08-30" };

    expect(findMissingPeriods("2026-08", [weekendOnly], [], rules)).toEqual([]);
  });
});
