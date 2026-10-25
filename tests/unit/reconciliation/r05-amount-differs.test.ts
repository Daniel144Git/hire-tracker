import { describe, expect, it } from "vitest";
import { amountDiffersFromExpected } from "@/lib/reconciliation/checks/r05-amount-differs";
import { context, hireLine, invoice, order } from "./builders";

function billed(net: number, lineOverrides = {}) {
  return invoice({ lines: [hireLine({ net, vat: Math.round(net * 20) / 100, ...lineOverrides })] });
}

describe("R5: amount differs from the agreed rate", () => {
  it("does not flag a line billed at the agreed rate: 4 wks 1 day at £50.00 = £210.00", () => {
    expect(amountDiffersFromExpected(context({ invoice: billed(210) }))).toEqual([]);
  });

  it("flags a line billed above the expected charge", () => {
    expect(amountDiffersFromExpected(context({ invoice: billed(218) }))).toEqual([
      expect.objectContaining({
        check: "R5",
        severity: "MEDIUM",
        invoiceLineId: "line-1",
        message: "Billed £218.00, expected £210.00 for 4 wks 1 day at £50.00/week",
        billed: 218,
        expected: 210,
        difference: 8,
      }),
    ]);
  });

  it("ignores a difference within the tolerance of £0.05", () => {
    expect(amountDiffersFromExpected(context({ invoice: billed(210.05) }))).toEqual([]);
    expect(amountDiffersFromExpected(context({ invoice: billed(210.06) }))).toHaveLength(1);
  });

  it("flags an undercharge as LOW", () => {
    const [finding] = amountDiffersFromExpected(context({ invoice: billed(200) }));

    expect(finding).toMatchObject({ severity: "LOW", difference: -10 });
  });

  it("multiplies by the quantity: 4 lifts are expected at £840.00", () => {
    expect(amountDiffersFromExpected(context({ invoice: billed(840, { qty: 4 }) }))).toEqual([]);
    expect(amountDiffersFromExpected(context({ invoice: billed(850, { qty: 4 }) }))).toHaveLength(
      1,
    );
  });

  it("expects 4 wks = £200.00 when the supplier does not charge Mon 31 Aug, a bank holiday", () => {
    const [finding] = amountDiffersFromExpected(
      context({ invoice: billed(210), rules: { chargeBankHolidays: false } }),
    );

    expect(finding).toMatchObject({ expected: 200, difference: 10 });
  });

  it("applies the one-week minimum to a hire of 3 working days", () => {
    const ctx = context({
      orders: [order({ startDate: "2026-08-04", offHireDate: "2026-08-06" })],
      invoice: billed(50, { periodFrom: "2026-08-04", periodTo: "2026-08-06" }),
    });

    expect(amountDiffersFromExpected(ctx)).toEqual([]);
  });

  it("leaves lines billed outside the hire to R1 and R2", () => {
    const ctx = context({ orders: [order({ offHireDate: "2026-08-12" })], invoice: billed(210) });

    expect(amountDiffersFromExpected(ctx)).toEqual([]);
  });

  it("skips lines it cannot price: no linked item, no period, or a credit", () => {
    for (const overrides of [{ hireItemId: null }, { periodFrom: null, periodTo: null }]) {
      expect(amountDiffersFromExpected(context({ invoice: billed(218, overrides) }))).toEqual([]);
    }
    expect(amountDiffersFromExpected(context({ invoice: billed(-218) }))).toEqual([]);
  });
});
