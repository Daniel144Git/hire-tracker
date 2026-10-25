import { describe, expect, it } from "vitest";
import { suspensionCredit } from "@/lib/reconciliation/checks/r16-suspension-credit";
import { context, hireLine, invoice } from "./builders";

const tenFreeDays = {
  siteId: "site-1",
  siteCode: "RVS",
  periodFrom: "2026-08-10",
  periodTo: "2026-08-21",
  freeDays: 10,
};
const suspensionCreditLine = (net: number) =>
  hireLine({
    id: "credit",
    position: 2,
    description: "Hire suspension 10 days",
    net,
    vat: net / 5,
  });

describe("R16: suspension credit on every order of a suspended site", () => {
  it("flags a hire line of a suspended site with no suspension credit", () => {
    expect(suspensionCredit(context({ suspensions: [tenFreeDays] }))).toEqual([
      expect.objectContaining({
        check: "R16",
        severity: "HIGH",
        invoiceLineId: "line-1",
        message:
          "Site RVS was suspended from 2026-08-10 to 2026-08-21 (10 free days), but there is no suspension credit for this line",
        billed: 0,
        expected: -100,
        difference: 100,
      }),
    ]);
  });

  it("accepts a credit of 10 days at £50.00/week = -£100.00", () => {
    const ctx = context({
      suspensions: [tenFreeDays],
      invoice: invoice({ lines: [hireLine(), suspensionCreditLine(-100)] }),
    });

    expect(suspensionCredit(ctx)).toEqual([]);
  });

  it("flags a suspension credit of the wrong amount", () => {
    const ctx = context({
      suspensions: [tenFreeDays],
      invoice: invoice({ lines: [hireLine(), suspensionCreditLine(-50)] }),
    });

    expect(suspensionCredit(ctx)).toEqual([
      expect.objectContaining({
        severity: "MEDIUM",
        invoiceLineId: "credit",
        message: "Suspension credit -£50.00, expected -£100.00 for 10 free days at £50.00/week",
        billed: -50,
        expected: -100,
        difference: 50,
      }),
    ]);
  });

  it("ignores a suspension of another site, or outside the billing period", () => {
    const otherSite = { ...tenFreeDays, siteId: "site-2", siteCode: "NGW" };
    const september = { ...tenFreeDays, periodFrom: "2026-09-07", periodTo: "2026-09-18" };

    expect(suspensionCredit(context({ suspensions: [otherSite, september] }))).toEqual([]);
  });

  it("does not check a credit note", () => {
    const ctx = context({
      suspensions: [tenFreeDays],
      invoice: invoice({ isCreditNote: true, lines: [hireLine({ net: -30, vat: -6 })] }),
    });

    expect(suspensionCredit(ctx)).toEqual([]);
  });
});
