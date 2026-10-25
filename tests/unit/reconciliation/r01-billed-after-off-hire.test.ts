import { describe, expect, it } from "vitest";
import { billedAfterOffHire } from "@/lib/reconciliation/checks/r01-billed-after-off-hire";
import { context, hireLine, invoice, order } from "./builders";

const offHiredWed12Aug = order({ offHireDate: "2026-08-12" });

describe("R1: billed after the end of hire", () => {
  it("flags a line billed past the off-hire date with the overcharged working days", () => {
    const findings = billedAfterOffHire(context({ orders: [offHiredWed12Aug] }));

    expect(findings).toEqual([
      {
        check: "R1",
        severity: "HIGH",
        invoiceLineId: "line-1",
        message:
          "Job J100101 was off-hired on 2026-08-12 but billed to 2026-08-31: 13 working days charged after off-hire",
        billed: 210,
        expected: 80,
        difference: 130,
        resolved: false,
        resolution: null,
      },
    ]);
  });

  it("does not flag a line that ends on the off-hire date", () => {
    const ctx = context({
      orders: [offHiredWed12Aug],
      invoice: invoice({ lines: [hireLine({ periodTo: "2026-08-12", net: 80, vat: 16 })] }),
    });

    expect(billedAfterOffHire(ctx)).toEqual([]);
  });

  it("does not flag weekend days after an off-hire on a Friday", () => {
    const ctx = context({
      orders: [order({ offHireDate: "2026-08-28" })],
      invoice: invoice({ lines: [hireLine({ periodTo: "2026-08-30", net: 200, vat: 40 })] }),
    });

    expect(billedAfterOffHire(ctx)).toEqual([]);
  });

  it("counts a bank holiday after off-hire only when the supplier charges bank holidays", () => {
    const offHiredFriday = order({ offHireDate: "2026-08-28" });

    const charged = billedAfterOffHire(context({ orders: [offHiredFriday] }));
    const notCharged = billedAfterOffHire(
      context({ orders: [offHiredFriday], rules: { chargeBankHolidays: false } }),
    );

    expect(charged).toHaveLength(1);
    expect(charged[0].message).toContain("1 working day charged after off-hire");
    expect(notCharged).toEqual([]);
  });

  it("does not flag an order that is still on hire", () => {
    expect(billedAfterOffHire(context())).toEqual([]);
  });

  it("reports the days but no amounts when the line is not linked to an item with a rate", () => {
    const ctx = context({
      orders: [offHiredWed12Aug],
      invoice: invoice({ lines: [hireLine({ hireItemId: null })] }),
    });

    expect(billedAfterOffHire(ctx)[0]).toMatchObject({
      billed: 210,
      expected: null,
      difference: null,
    });
  });

  it("closes the finding when a credit note credits the overcharge", () => {
    const credit = invoice({
      id: "credit-1",
      number: "C-1001",
      date: "2026-09-10",
      type: "RETURN",
      isCreditNote: true,
      lines: [
        hireLine({
          id: "credit-line",
          periodFrom: "2026-08-31",
          periodTo: "2026-08-13",
          net: -130,
          vat: -26,
        }),
      ],
    });

    const [finding] = billedAfterOffHire(
      context({ orders: [offHiredWed12Aug], otherInvoices: [credit] }),
    );

    expect(finding).toMatchObject({ resolved: true, resolution: "Credited on C-1001" });
  });

  it("keeps the finding open when the credit is smaller than the overcharge", () => {
    const partialCredit = invoice({
      id: "credit-1",
      number: "C-1001",
      isCreditNote: true,
      type: "RETURN",
      lines: [hireLine({ id: "credit-line", net: -50, vat: -10 })],
    });

    const [finding] = billedAfterOffHire(
      context({ orders: [offHiredWed12Aug], otherInvoices: [partialCredit] }),
    );

    expect(finding.resolved).toBe(false);
  });

  it("does not check a credit note itself", () => {
    const ctx = context({
      orders: [offHiredWed12Aug],
      invoice: invoice({ isCreditNote: true, lines: [hireLine({ net: -130, vat: -26 })] }),
    });

    expect(billedAfterOffHire(ctx)).toEqual([]);
  });
});
