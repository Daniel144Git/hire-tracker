import { describe, expect, it } from "vitest";
import {
  reconcileStatement,
  type InvoiceForStatement,
  type StatementForReconciliation,
} from "@/lib/statements/reconcile";

const invoice = (overrides: Partial<InvoiceForStatement> = {}): InvoiceForStatement => ({
  id: "inv-1",
  number: "30451207",
  date: "2026-08-31",
  gross: 665.28,
  paymentStatus: "UNPAID",
  ...overrides,
});

const statement = (
  lines: { invoiceNo: string; amount: number; invoiceDate?: string }[],
): StatementForReconciliation => ({
  date: "2026-09-02",
  lines: lines.map((line, index) => ({
    id: `line-${index + 1}`,
    invoiceDate: "2026-08-31",
    ...line,
  })),
});

describe("reconcileStatement (R11): the supplier's statement against our invoices", () => {
  it("matches every line to the invoice with its number and amount", () => {
    const result = reconcileStatement(
      statement([
        { invoiceNo: "30451207", amount: 665.28 },
        { invoiceNo: "30460001", amount: -31.68 },
      ]),
      [invoice(), invoice({ id: "credit-1", number: "30460001", gross: -31.68 })],
    );

    expect(result).toEqual({
      matches: [
        { lineId: "line-1", invoiceId: "inv-1" },
        { lineId: "line-2", invoiceId: "credit-1" },
      ],
      problems: [],
    });
  });

  it("flags an invoice on the statement that is not in Hire Tracker: never received", () => {
    const result = reconcileStatement(statement([{ invoiceNo: "30499999", amount: 336.19 }]), []);

    expect(result.problems).toEqual([
      {
        kind: "MISSING_INVOICE",
        severity: "HIGH",
        lineId: "line-1",
        invoiceId: null,
        invoiceNo: "30499999",
        statementAmount: 336.19,
        ourAmount: null,
        message:
          "Invoice 30499999 is on the statement for £336.19 but not in Hire Tracker: ask the supplier for a copy",
      },
    ]);
  });

  it("flags an amount that differs from the invoice we hold", () => {
    const result = reconcileStatement(statement([{ invoiceNo: "30451207", amount: 700 }]), [
      invoice(),
    ]);

    expect(result.problems).toEqual([
      expect.objectContaining({
        kind: "AMOUNT_DIFFERS",
        severity: "HIGH",
        lineId: "line-1",
        invoiceId: "inv-1",
        statementAmount: 700,
        ourAmount: 665.28,
        message: "Invoice 30451207 is on the statement for £700.00 but the invoice is for £665.28",
      }),
    ]);
    expect(result.matches).toEqual([{ lineId: "line-1", invoiceId: "inv-1" }]);
  });

  it("flags an invoice paid in Hire Tracker that the supplier still lists as open", () => {
    const result = reconcileStatement(statement([{ invoiceNo: "30451207", amount: 665.28 }]), [
      invoice({ paymentStatus: "PAID" }),
    ]);

    expect(result.problems).toEqual([
      expect.objectContaining({
        kind: "PAID_BUT_LISTED",
        severity: "MEDIUM",
        invoiceId: "inv-1",
        message:
          "Invoice 30451207 is paid in Hire Tracker but still open on the statement: check the payment reached the supplier",
      }),
    ]);
  });

  it("flags an unpaid invoice of ours that the statement does not list", () => {
    const result = reconcileStatement(statement([]), [invoice()]);

    expect(result.problems).toEqual([
      {
        kind: "NOT_ON_STATEMENT",
        severity: "MEDIUM",
        lineId: null,
        invoiceId: "inv-1",
        invoiceNo: "30451207",
        statementAmount: null,
        ourAmount: 665.28,
        message:
          "Invoice 30451207 for £665.28 is unpaid in Hire Tracker but not on the statement: the supplier may consider it paid, or never issued it",
      },
    ]);
  });

  it.each([
    ["paid", { paymentStatus: "PAID" as const }],
    ["credited", { paymentStatus: "CREDITED" as const }],
    ["dated after the statement", { date: "2026-09-03" }],
    // Raised the day the statement was printed: it may not be on it yet.
    ["dated the day of the statement", { date: "2026-09-02" }],
  ])("does not expect an invoice that is %s on the statement", (_case, overrides) => {
    expect(reconcileStatement(statement([]), [invoice(overrides)]).problems).toEqual([]);
  });

  it("checks payments only on the supplier's latest statement", () => {
    // An older statement listed the invoice while it was still open; it was paid since.
    const result = reconcileStatement(
      statement([{ invoiceNo: "30451207", amount: 665.28 }]),
      [invoice({ paymentStatus: "PAID" })],
      { latest: false },
    );

    expect(result.problems).toEqual([]);
  });

  it("matches invoice numbers whatever their case or spaces", () => {
    const result = reconcileStatement(statement([{ invoiceNo: " apx-29999 ", amount: 10 }]), [
      invoice({ number: "APX-29999", gross: 10 }),
    ]);

    expect(result.problems).toEqual([]);
  });
});
