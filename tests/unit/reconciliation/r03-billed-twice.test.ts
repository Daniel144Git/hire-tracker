import { describe, expect, it } from "vitest";
import { billedTwice } from "@/lib/reconciliation/checks/r03-billed-twice";
import { context, hireLine, invoice } from "./builders";

function earlierInvoice(lineOverrides = {}, invoiceOverrides = {}) {
  return invoice({
    id: "invoice-0",
    number: "INV-20700",
    date: "2026-08-15",
    lines: [
      hireLine({ id: "line-0", periodTo: "2026-08-14", net: 100, vat: 20, ...lineOverrides }),
    ],
    ...invoiceOverrides,
  });
}

describe("R3: the same item billed twice for overlapping days", () => {
  it("flags the working days already billed on an earlier invoice", () => {
    const findings = billedTwice(context({ otherInvoices: [earlierInvoice()] }));

    expect(findings).toEqual([
      expect.objectContaining({
        check: "R3",
        severity: "HIGH",
        invoiceLineId: "line-1",
        message:
          "2026-08-01 to 2026-08-14 was already billed on INV-20700: 10 working days billed twice",
        billed: 210,
        expected: null,
        difference: 100,
      }),
    ]);
  });

  it("does not flag periods that follow each other without overlapping", () => {
    const ctx = context({
      otherInvoices: [earlierInvoice()],
      invoice: invoice({ lines: [hireLine({ periodFrom: "2026-08-15", net: 110, vat: 22 })] }),
    });

    expect(billedTwice(ctx)).toEqual([]);
  });

  it("does not flag an overlap that is only a weekend day", () => {
    const ctx = context({
      otherInvoices: [earlierInvoice({ periodTo: "2026-08-15" })],
      invoice: invoice({ lines: [hireLine({ periodFrom: "2026-08-15", net: 110, vat: 22 })] }),
    });

    expect(billedTwice(ctx)).toEqual([]);
  });

  it("does not count a credit note as a second billing", () => {
    const credit = earlierInvoice({ net: -100, vat: -20 }, { isCreditNote: true });

    expect(billedTwice(context({ otherInvoices: [credit] }))).toEqual([]);
  });

  it("flags only the later invoice, not the one that was billed first", () => {
    const later = earlierInvoice({}, { date: "2026-09-30", number: "INV-20900" });

    expect(billedTwice(context({ otherInvoices: [later] }))).toEqual([]);
  });

  it("does not compare different items", () => {
    const otherItem = earlierInvoice({ hireItemId: "item-2" });

    expect(billedTwice(context({ otherInvoices: [otherItem] }))).toEqual([]);
  });
});
