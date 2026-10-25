import { describe, expect, it } from "vitest";
import { hireAlerts, type RowWithSite } from "@/lib/register/alerts";

const site = { id: "rvs", code: "RVS", name: "Riverside Tower" };

const row = (overrides: Partial<RowWithSite> = {}): RowWithSite => ({
  site,
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
  startDate: "2026-09-01",
  offHireDate: null,
  calendarDaysOnHire: 30,
  chargeableDays: 22,
  costToDate: 220,
  billedToDate: 210,
  notYetBilled: 10,
  ...overrides,
});

const settings = { longHireDays: 84, costLimit: 1000, collectionDays: 7 };
const asOf = "2026-10-01";

describe("hireAlerts: hires to look at", () => {
  it("raises nothing for a short, cheap hire", () => {
    expect(hireAlerts([row()], asOf, settings)).toEqual([]);
  });

  it("flags an item on hire for the long-hire limit or more", () => {
    expect(
      hireAlerts([row({ calendarDaysOnHire: 84, startDate: "2026-07-09" })], asOf, settings),
    ).toEqual([
      expect.objectContaining({
        kind: "LONG_HIRE",
        site,
        itemId: "item-1",
        message:
          "Scissor lift 19ft electric (APX-SL-1042) has been on hire for 12 weeks, since 2026-07-09: is it still needed on site?",
      }),
    ]);
  });

  it("flags an item that has cost the cost limit or more so far", () => {
    expect(hireAlerts([row({ costToDate: 1000 })], asOf, settings)).toEqual([
      expect.objectContaining({
        kind: "COSTLY",
        message:
          "Scissor lift 19ft electric (APX-SL-1042) has cost £1,000.00 so far at £50.00/week: would buying it, or a cheaper item, save money?",
      }),
    ]);
  });

  it("flags an off-hired item not collected after the collection days", () => {
    const offHired = row({ status: "OFF_HIRED", offHireDate: "2026-09-23" });
    expect(hireAlerts([offHired], asOf, settings)).toEqual([
      expect.objectContaining({
        kind: "NOT_COLLECTED",
        message:
          "Scissor lift 19ft electric (APX-SL-1042) was off hired on 2026-09-23, 8 days ago, and is not collected yet: chase the collection",
      }),
    ]);
    expect(
      hireAlerts([row({ status: "OFF_HIRED", offHireDate: "2026-09-24" })], asOf, settings),
    ).toEqual([]);
  });

  it("does not call an off-hired item a long hire", () => {
    const offHired = row({
      status: "OFF_HIRED",
      offHireDate: "2026-09-30",
      calendarDaysOnHire: 200,
    });
    expect(hireAlerts([offHired], asOf, settings)).toEqual([]);
  });

  it("lists by site, then the most urgent kind first", () => {
    const ngw = { id: "ngw", code: "NGW", name: "Northgate Wharf" };
    const alerts = hireAlerts(
      [
        row({ costToDate: 2000, calendarDaysOnHire: 100 }),
        row({ site: ngw, itemId: "item-2", costToDate: 1500 }),
      ],
      asOf,
      settings,
    );
    expect(alerts.map((a) => [a.site.code, a.kind])).toEqual([
      ["NGW", "COSTLY"],
      ["RVS", "LONG_HIRE"],
      ["RVS", "COSTLY"],
    ]);
  });
});
