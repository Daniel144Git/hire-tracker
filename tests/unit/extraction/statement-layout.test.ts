import { describe, expect, it } from "vitest";
import { extractStatement } from "@/lib/extraction/statement-layout";
import { despatchInvoice, despatchStatement, fragmentsOf } from "../../support/invoice-documents";

const read = (document: string) => extractStatement(fragmentsOf(document));

describe("extractStatement", () => {
  it("reads the open invoices, debits and credits, a wrapped reference and the total", () => {
    expect(read(despatchStatement())).toEqual({
      accountNo: "APX-000123",
      date: "2026-09-02",
      total: 1355.28,
      warnings: [],
      lines: [
        {
          invoiceDate: "2026-07-31",
          jobNo: "170200345",
          invoiceNo: "30390001",
          customerRef: "Riverside",
          amount: 665.28,
        },
        {
          invoiceDate: "2026-08-31",
          jobNo: "170200345",
          invoiceNo: "30451207",
          customerRef: "RIVERSIDE",
          amount: 665.28,
        },
        {
          invoiceDate: "2026-09-02",
          jobNo: "170200400",
          invoiceNo: "30451300",
          customerRef: "Northgate Works Leeds",
          amount: 56.4,
        },
        {
          invoiceDate: "2026-08-30",
          jobNo: "170200345",
          invoiceNo: "30460001",
          customerRef: "Riverside",
          amount: -31.68,
        },
      ],
    });
  });

  it("reads amounts of a thousand pounds and more", () => {
    const result = read(
      despatchStatement({ rows: [["31/08/2026", "170200500", "30470000", "Riverside", 1458.26]] }),
    );
    expect(result?.lines.map((line) => line.amount)).toEqual([1458.26]);
    expect(result?.total).toBe(1458.26);
  });

  it("warns when the lines do not add up to the total printed", () => {
    const document = despatchStatement().replace(" 1,355.28 ", " 1,355.82 ");
    expect(read(document)?.warnings).toEqual([
      "The lines add up to £1,355.28 but the statement total is £1,355.82.",
    ]);
  });

  it("returns null for a document that is not a statement", () => {
    expect(read(despatchInvoice())).toBeNull();
  });
});
