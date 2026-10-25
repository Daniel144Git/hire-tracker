import { describe, expect, it } from "vitest";
import { vatAndTotals } from "@/lib/reconciliation/checks/r10-vat-and-totals";
import { context, hireLine, invoice, line } from "./builders";

describe("R10: VAT per line and invoice totals", () => {
  it("does not flag an invoice whose line VAT is 20% and whose totals add up", () => {
    const ctx = context({
      invoice: invoice({
        lines: [hireLine(), line({ chargeType: "DAMAGE_WAIVER", net: 21, vat: 4.2 })],
      }),
    });

    expect(vatAndTotals(ctx)).toEqual([]);
  });

  it("flags a line whose VAT is not 20% of its net, rounded to the penny", () => {
    const ctx = context({ invoice: invoice({ lines: [hireLine({ net: 41.29, vat: 8.27 })] }) });

    expect(vatAndTotals(ctx)).toEqual([
      expect.objectContaining({
        check: "R10",
        invoiceLineId: "line-1",
        message: "VAT £8.27 on a net of £41.29: 20% is £8.26",
        billed: 8.27,
        expected: 8.26,
        difference: 0.01,
      }),
    ]);
  });

  it("accepts 0% VAT on loss and damage charges, which are outside the scope of VAT", () => {
    const ctx = context({
      invoice: invoice({ lines: [line({ chargeType: "OTHER", net: 125, vat: 0 })] }),
    });

    expect(vatAndTotals(ctx)).toEqual([]);
  });

  it("flags a header net that is not the sum of the lines", () => {
    const ctx = context({ invoice: invoice({ net: 215, gross: 257 }) });

    expect(vatAndTotals(ctx)).toEqual([
      expect.objectContaining({
        invoiceLineId: null,
        message: "Net total £215.00 is not the sum of the lines, £210.00",
        billed: 215,
        expected: 210,
        difference: 5,
      }),
    ]);
  });

  it("flags a gross that is not net + VAT", () => {
    const ctx = context({ invoice: invoice({ gross: 253 }) });

    expect(vatAndTotals(ctx)).toEqual([
      expect.objectContaining({ message: "Gross £253.00 is not net + VAT, £252.00" }),
    ]);
  });

  describe("rounding (brief 4.3): VAT is rounded per line and the total is the sum", () => {
    // Three lines of £0.13: each VAT is £0.026, rounded to £0.03, so the VAT total is £0.09,
    // while 20% of the £0.39 net total would be £0.078, rounded to £0.08.
    const lines = [1, 2, 3].map((n) =>
      hireLine({ id: `line-${n}`, position: n, net: 0.13, vat: 0.03 }),
    );

    it("accepts a VAT total of £0.09, the sum of the rounded lines", () => {
      expect(vatAndTotals(context({ invoice: invoice({ lines, vat: 0.09 }) }))).toEqual([]);
    });

    it("flags a VAT total of £0.08, 20% of the net total, as not the sum of the lines", () => {
      const findings = vatAndTotals(
        context({ invoice: invoice({ lines, vat: 0.08, gross: 0.47 }) }),
      );

      expect(findings).toEqual([
        expect.objectContaining({ message: "VAT total £0.08 is not the sum of the lines, £0.09" }),
      ]);
    });
  });

  it("accepts the negative VAT of a credit note", () => {
    const ctx = context({
      invoice: invoice({ isCreditNote: true, lines: [hireLine({ net: -30, vat: -6 })] }),
    });

    expect(vatAndTotals(ctx)).toEqual([]);
  });
});
