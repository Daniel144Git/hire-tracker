import { describe, expect, it } from "vitest";
import { rateDrift } from "@/lib/reconciliation/checks/r06-rate-drift";
import { context, hireLine, invoice } from "./builders";

/** July 2026 has 23 working days: 4 wks 3 days, £230.00 at £50.00/week. */
function julyInvoice(net = 230, overrides = {}) {
  return invoice({
    id: "invoice-july",
    number: "INV-20700",
    date: "2026-07-31",
    lines: [
      hireLine({
        id: "july-line",
        periodFrom: "2026-07-01",
        periodTo: "2026-07-31",
        net,
        vat: net / 5,
      }),
    ],
    ...overrides,
  });
}

/** August billed at £52.50/week: 4 wks 1 day = £220.50. */
const augustAtNewRate = invoice({ lines: [hireLine({ net: 220.5, vat: 44.1 })] });

describe("R6: rate drift from the previous billing of the same item", () => {
  it("flags a weekly rate that changed since last month", () => {
    const findings = rateDrift(
      context({ invoice: augustAtNewRate, otherInvoices: [julyInvoice()] }),
    );

    expect(findings).toEqual([
      expect.objectContaining({
        check: "R6",
        severity: "MEDIUM",
        invoiceLineId: "line-1",
        message:
          "Billed at £52.50/week, but £50.00/week on INV-20700: a rate change nobody agreed?",
        billed: 220.5,
        expected: 210,
        difference: 10.5,
      }),
    ]);
  });

  it("compares the weekly rate, so months of different length at the same rate are fine", () => {
    expect(rateDrift(context({ otherInvoices: [julyInvoice()] }))).toEqual([]);
  });

  it("ignores a change within the tolerance", () => {
    // £230.10 for 23 days is £50.02/week.
    expect(rateDrift(context({ otherInvoices: [julyInvoice(230.1)] }))).toEqual([]);
  });

  it("compares with the most recent earlier billing only", () => {
    const june = invoice({
      id: "invoice-june",
      number: "INV-20600",
      date: "2026-06-30",
      lines: [
        hireLine({
          id: "june-line",
          periodFrom: "2026-06-01",
          periodTo: "2026-06-30",
          net: 198,
          vat: 39.6,
        }),
      ],
    });

    expect(rateDrift(context({ otherInvoices: [june, julyInvoice()] }))).toEqual([]);
  });

  it("ignores periods shorter than a week, where the minimum charge distorts the rate", () => {
    const shortLine = invoice({
      lines: [hireLine({ periodFrom: "2026-08-03", periodTo: "2026-08-05", net: 50, vat: 10 })],
    });

    expect(rateDrift(context({ invoice: shortLine, otherInvoices: [julyInvoice()] }))).toEqual([]);
  });

  it("does not compare with a credit note", () => {
    const credit = julyInvoice(-230, { isCreditNote: true });

    expect(rateDrift(context({ invoice: augustAtNewRate, otherInvoices: [credit] }))).toEqual([]);
  });

  it("has nothing to compare on the first billing of an item", () => {
    expect(rateDrift(context({ invoice: augustAtNewRate }))).toEqual([]);
  });
});
