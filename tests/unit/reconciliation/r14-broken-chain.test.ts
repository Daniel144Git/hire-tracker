import { describe, expect, it } from "vitest";
import { brokenContinuationChain } from "@/lib/reconciliation/checks/r14-broken-chain";
import { context, hireLine, invoice } from "./builders";

const july = invoice({
  id: "invoice-july",
  number: "INV-20700",
  date: "2026-07-31",
  lines: [
    hireLine({
      id: "july-line",
      periodFrom: "2026-07-01",
      periodTo: "2026-07-31",
      net: 230,
      vat: 46,
    }),
  ],
});

describe("R14: broken continuation chain", () => {
  it("does not flag an invoice whose 'last invoice' is the previous invoice of the job", () => {
    const ctx = context({
      invoice: invoice({ lastInvoiceNo: "INV-20700" }),
      otherInvoices: [july],
    });

    expect(brokenContinuationChain(ctx)).toEqual([]);
  });

  it("flags a 'last invoice' that is not the previous invoice held for the job", () => {
    const ctx = context({
      invoice: invoice({ lastInvoiceNo: "INV-20750" }),
      otherInvoices: [july],
    });

    expect(brokenContinuationChain(ctx)).toEqual([
      expect.objectContaining({
        check: "R14",
        severity: "MEDIUM",
        invoiceLineId: null,
        message:
          "Last invoice printed is INV-20750, but the previous invoice held for job J100101 is INV-20700: an invoice may be missing",
      }),
    ]);
  });

  it("flags a 'last invoice' when no earlier invoice of the job is held", () => {
    const ctx = context({ invoice: invoice({ lastInvoiceNo: "INV-20700" }) });

    expect(brokenContinuationChain(ctx)[0].message).toBe(
      "Last invoice INV-20700 is not in Hire Tracker: ask the supplier for a copy",
    );
  });

  it("does not count credit notes in the chain", () => {
    const credit = invoice({
      ...july,
      id: "credit",
      number: "C-1001",
      date: "2026-08-10",
      isCreditNote: true,
    });
    const ctx = context({
      invoice: invoice({ lastInvoiceNo: "INV-20700" }),
      otherInvoices: [july, credit],
    });

    expect(brokenContinuationChain(ctx)).toEqual([]);
  });

  it("does not check an invoice with no 'last invoice', such as the first one of a job", () => {
    expect(brokenContinuationChain(context({ otherInvoices: [july] }))).toEqual([]);
  });
});
