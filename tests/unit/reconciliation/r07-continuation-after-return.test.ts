import { describe, expect, it } from "vitest";
import { continuationAfterReturn } from "@/lib/reconciliation/checks/r07-continuation-after-return";
import { context, hireLine, invoice, line } from "./builders";

function returnInvoice(overrides = {}) {
  return invoice({
    id: "return-1",
    number: "INV-R100",
    date: "2026-08-14",
    type: "RETURN",
    lines: [hireLine({ id: "return-line", periodTo: "2026-08-12", net: 80, vat: 16 })],
    ...overrides,
  });
}

describe("R7: a continuation invoice after a return invoice for the same order", () => {
  it("flags a continuation dated after the order's return invoice", () => {
    expect(continuationAfterReturn(context({ otherInvoices: [returnInvoice()] }))).toEqual([
      expect.objectContaining({
        check: "R7",
        severity: "MEDIUM",
        invoiceLineId: "line-1",
        message:
          "Continuation invoice for job J100101 after its return invoice INV-R100 of 2026-08-14",
      }),
    ]);
  });

  it("ignores a Return invoice that only has loss charges: it does not end the hire", () => {
    const lossCharges = returnInvoice({
      lines: [line({ chargeType: "OTHER", net: 25, vat: 0, orderId: "order-1" })],
    });

    expect(continuationAfterReturn(context({ otherInvoices: [lossCharges] }))).toEqual([]);
  });

  it("does not flag a continuation dated before the return invoice", () => {
    const later = returnInvoice({ date: "2026-09-10" });

    expect(continuationAfterReturn(context({ otherInvoices: [later] }))).toEqual([]);
  });

  it("ignores credit notes of type Return", () => {
    const credit = returnInvoice({
      isCreditNote: true,
      lines: [hireLine({ id: "c", net: -30, vat: -6 })],
    });

    expect(continuationAfterReturn(context({ otherInvoices: [credit] }))).toEqual([]);
  });

  it("does not check an invoice that is not a continuation", () => {
    const ctx = context({ invoice: invoice({ type: "RETURN" }), otherInvoices: [returnInvoice()] });

    expect(continuationAfterReturn(ctx)).toEqual([]);
  });
});
