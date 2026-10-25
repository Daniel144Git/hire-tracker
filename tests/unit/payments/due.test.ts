import { describe, expect, it } from "vitest";
import { groupInvoicesByDueDate, type PayableInvoice } from "@/lib/payments/due";

const AS_OF = "2026-10-25";

function invoice(dueDate: string, overrides: Partial<PayableInvoice> = {}): PayableInvoice {
  return {
    id: `inv-${dueDate}`,
    number: `INV-${dueDate}`,
    supplierName: "Apex Plant Hire",
    siteCodes: ["RVS"],
    dueDate,
    gross: 100,
    paymentStatus: "UNPAID",
    isCreditNote: false,
    ...overrides,
  };
}

const numbers = (list: { number: string }[]) => list.map((i) => i.number);

describe("groupInvoicesByDueDate: what to pay, as of a date", () => {
  it("puts an unpaid invoice past its due date in overdue, with the days overdue", () => {
    const { overdue } = groupInvoicesByDueDate([invoice("2026-09-30")], AS_OF);

    expect(overdue).toEqual([
      expect.objectContaining({ number: "INV-2026-09-30", daysOverdue: 25 }),
    ]);
  });

  it.each([
    ["2026-10-25", "dueIn7Days"],
    ["2026-11-01", "dueIn7Days"],
    ["2026-11-02", "dueIn14Days"],
    ["2026-11-08", "dueIn14Days"],
    ["2026-11-09", "later"],
  ] as const)("as of 2026-10-25, an invoice due on %s goes in %s", (dueDate, group) => {
    const groups = groupInvoicesByDueDate([invoice(dueDate)], AS_OF);

    expect(numbers(groups[group])).toEqual([`INV-${dueDate}`]);
  });

  it("leaves out paid and credited invoices, and credit notes", () => {
    const groups = groupInvoicesByDueDate(
      [
        invoice("2026-09-30", { paymentStatus: "PAID" }),
        invoice("2026-09-29", { paymentStatus: "CREDITED" }),
        invoice("2026-09-28", { isCreditNote: true, gross: -39.6 }),
      ],
      AS_OF,
    );

    expect(groups.totals.outstanding).toBe(0);
    expect(numbers(groups.overdue)).toEqual([]);
  });

  it("keeps queried invoices apart: they are on hold, not to pay", () => {
    const groups = groupInvoicesByDueDate(
      [invoice("2026-09-30", { paymentStatus: "QUERIED" })],
      AS_OF,
    );

    expect(numbers(groups.queried)).toEqual(["INV-2026-09-30"]);
    expect(numbers(groups.overdue)).toEqual([]);
    expect(groups.totals).toMatchObject({ outstanding: 0, queried: 100 });
  });

  it("totals each group in pence and orders invoices by due date", () => {
    const groups = groupInvoicesByDueDate(
      [
        invoice("2026-10-10", { gross: 0.1 }),
        invoice("2026-09-30", { gross: 0.2 }),
        invoice("2026-10-28", { gross: 277.2 }),
      ],
      AS_OF,
    );

    expect(numbers(groups.overdue)).toEqual(["INV-2026-09-30", "INV-2026-10-10"]);
    expect(groups.totals).toEqual({
      overdue: 0.3,
      dueIn7Days: 277.2,
      dueIn14Days: 0,
      later: 0,
      outstanding: 277.5,
      queried: 0,
    });
  });

  it("totals what is owed per site", () => {
    const groups = groupInvoicesByDueDate(
      [
        invoice("2026-09-30", { gross: 100, siteCodes: ["RVS"] }),
        invoice("2026-10-28", { gross: 50, siteCodes: ["RVS"] }),
        invoice("2026-11-20", { gross: 20, siteCodes: ["NGW"] }),
      ],
      AS_OF,
    );

    expect(groups.bySite).toEqual([
      { siteCode: "NGW", outstanding: 20, overdue: 0 },
      { siteCode: "RVS", outstanding: 150, overdue: 100 },
    ]);
  });
});
