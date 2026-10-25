import { describe, expect, it } from "vitest";
import { buildOnHireRegister, type RegisterOrder } from "@/lib/register/on-hire-register";

const rules = { chargeBankHolidays: true, bankHolidays: ["2026-08-31"], minChargeDays: 5 };
const AS_OF = "2026-09-15";

function order(overrides: Partial<RegisterOrder> = {}): RegisterOrder {
  return {
    id: "order-1",
    supplierJobNo: "J100101",
    supplierName: "Apex Plant Hire",
    trade: "MECH",
    status: "ON_HIRE",
    startDate: "2026-07-01",
    offHireDate: null,
    rules,
    items: [
      {
        id: "item-1",
        description: "Scissor lift 19ft electric",
        fleetCode: "APX-SL-1042",
        qty: 1,
        weeklyRate: 50,
      },
    ],
    ...overrides,
  };
}

describe("buildOnHireRegister: what is on site, since when, and what it has cost", () => {
  it("shows an item on hire since 1 July, as of 15 September: 55 working days = 11 wks = £550.00", () => {
    const [row] = buildOnHireRegister([order()], [], AS_OF);

    expect(row).toEqual({
      orderId: "order-1",
      supplierJobNo: "J100101",
      supplierName: "Apex Plant Hire",
      trade: "MECH",
      status: "ON_HIRE",
      itemId: "item-1",
      description: "Scissor lift 19ft electric",
      fleetCode: "APX-SL-1042",
      qty: 1,
      weeklyRate: 50,
      startDate: "2026-07-01",
      offHireDate: null,
      calendarDaysOnHire: 77,
      chargeableDays: 55,
      costToDate: 550,
      billedToDate: 0,
      notYetBilled: 550,
    });
  });

  it("subtracts what was billed for the item, credits included", () => {
    const billed = [
      { hireItemId: "item-1", net: 230 },
      { hireItemId: "item-1", net: 210 },
      { hireItemId: "item-1", net: -10 },
      { hireItemId: "another-item", net: 999 },
    ];

    const [row] = buildOnHireRegister([order()], billed, AS_OF);

    expect(row).toMatchObject({ billedToDate: 430, notYetBilled: 120 });
  });

  it("shows a negative 'not yet billed' when more was billed than the hire has cost", () => {
    const [row] = buildOnHireRegister([order()], [{ hireItemId: "item-1", net: 600 }], AS_OF);

    expect(row.notYetBilled).toBe(-50);
  });

  it("stops counting at the off-hire date of an item waiting for collection", () => {
    const offHired = order({
      status: "OFF_HIRED",
      startDate: "2026-07-06",
      offHireDate: "2026-08-12",
      items: [
        {
          id: "item-1",
          description: "Scissor lift 26ft",
          fleetCode: "APX-SL-2610",
          qty: 1,
          weeklyRate: 65,
        },
      ],
    });

    const [row] = buildOnHireRegister([offHired], [], AS_OF);

    expect(row).toMatchObject({
      status: "OFF_HIRED",
      calendarDaysOnHire: 38,
      chargeableDays: 28,
      costToDate: 364,
    });
  });

  it("leaves out orders already collected: they are no longer on site", () => {
    expect(buildOnHireRegister([order({ status: "COLLECTED" })], [], AS_OF)).toEqual([]);
  });

  it("shows an item delivered after the date asked for with no days and no cost", () => {
    const [row] = buildOnHireRegister([order({ startDate: "2026-09-21" })], [], AS_OF);

    expect(row).toMatchObject({ calendarDaysOnHire: 0, chargeableDays: 0, costToDate: 0 });
  });

  it("multiplies by the quantity: 4 platforms for 24 working days = 4 x £168.00", () => {
    const fourPlatforms = order({
      startDate: "2026-08-13",
      items: [
        {
          id: "item-1",
          description: "Mobile platform 3m",
          fleetCode: null,
          qty: 4,
          weeklyRate: 35,
        },
      ],
    });

    expect(buildOnHireRegister([fourPlatforms], [], AS_OF)[0]).toMatchObject({
      chargeableDays: 24,
      costToDate: 672,
    });
  });

  it("follows the supplier's bank holiday rule: 54 working days when 31 August is free", () => {
    const noBankHolidays = order({ rules: { ...rules, chargeBankHolidays: false } });

    expect(buildOnHireRegister([noBankHolidays], [], AS_OF)[0]).toMatchObject({
      chargeableDays: 54,
      costToDate: 540,
    });
  });

  it("lists one row per item, oldest hire first", () => {
    const newer = order({ id: "order-2", supplierJobNo: "J100102", startDate: "2026-08-13" });
    const older = order({
      items: [
        { id: "a", description: "Lift", fleetCode: "A", qty: 1, weeklyRate: 50 },
        { id: "b", description: "Groover", fleetCode: "B", qty: 1, weeklyRate: 41.29 },
      ],
    });

    const rows = buildOnHireRegister([newer, older], [], AS_OF);

    expect(rows.map((r) => [r.supplierJobNo, r.itemId])).toEqual([
      ["J100101", "a"],
      ["J100101", "b"],
      ["J100102", "item-1"],
    ]);
  });
});
