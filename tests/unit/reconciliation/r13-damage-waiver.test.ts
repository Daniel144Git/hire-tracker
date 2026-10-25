import { describe, expect, it } from "vitest";
import { damageWaiverCheck } from "@/lib/reconciliation/checks/r13-damage-waiver";
import { context, hireLine, invoice, line, order } from "./builders";

const waiver = (net: number) => line({ chargeType: "DAMAGE_WAIVER", net, position: 9, id: "dw" });
const transport = (net: number) =>
  line({ chargeType: "TRANSPORT", net, position: 8, id: "transport" });
const secondHireLine = hireLine({
  id: "line-2",
  position: 2,
  net: 130,
  vat: 26,
  hireItemId: "item-2",
});

describe("R13: damage waiver", () => {
  it("does not flag a waiver of 10% of the hire lines: 10% of £210 + £130 = £34.00", () => {
    const ctx = context({ invoice: invoice({ lines: [hireLine(), secondHireLine, waiver(34)] }) });

    expect(damageWaiverCheck(ctx)).toEqual([]);
  });

  it("flags a waiver that is not the configured % of the hire lines", () => {
    const ctx = context({ invoice: invoice({ lines: [hireLine(), waiver(25)] }) });

    expect(damageWaiverCheck(ctx)).toEqual([
      expect.objectContaining({
        check: "R13",
        severity: "MEDIUM",
        invoiceLineId: "dw",
        message: "Damage waiver £25.00, expected £21.00: 10% of the hire charges of £210.00",
        billed: 25,
        expected: 21,
        difference: 4,
      }),
    ]);
  });

  it("says so when the waiver was also charged on transport", () => {
    const ctx = context({ invoice: invoice({ lines: [hireLine(), transport(85), waiver(29.5)] }) });

    expect(damageWaiverCheck(ctx)[0].message).toBe(
      "Damage waiver £29.50 includes transport: 10% of the hire charges of £210.00 is £21.00",
    );
  });

  it("flags a waiver when no order on the invoice carries damage waiver", () => {
    const ctx = context({
      orders: [order({ damageWaiverApplies: false })],
      invoice: invoice({ lines: [hireLine(), waiver(21)] }),
    });

    expect(damageWaiverCheck(ctx)).toEqual([
      expect.objectContaining({
        message: "Damage waiver £21.00 charged, but no order on this invoice carries damage waiver",
        expected: 0,
        difference: 21,
      }),
    ]);
  });

  it("leaves the hire lines of an exempt order out of the expected waiver", () => {
    const exempt = order({ id: "order-2", supplierJobNo: "J100102", damageWaiverApplies: false });
    const ctx = context({
      orders: [order(), exempt],
      invoice: invoice({
        lines: [hireLine(), { ...secondHireLine, orderId: "order-2" }, waiver(21)],
      }),
    });

    expect(damageWaiverCheck(ctx)).toEqual([]);
  });

  it("flags a missing waiver as LOW when one was expected", () => {
    expect(damageWaiverCheck(context())).toEqual([
      expect.objectContaining({
        severity: "LOW",
        invoiceLineId: null,
        message: "No damage waiver line, expected £21.00",
        billed: 0,
        expected: 21,
      }),
    ]);
  });

  it("accepts the negative waiver of a credit note", () => {
    const ctx = context({
      invoice: invoice({
        isCreditNote: true,
        lines: [hireLine({ net: -30, vat: -6 }), waiver(-3)],
      }),
    });

    expect(damageWaiverCheck(ctx)).toEqual([]);
  });

  it("expects nothing on an invoice with only transport", () => {
    const ctx = context({ invoice: invoice({ lines: [transport(85)] }) });

    expect(damageWaiverCheck(ctx)).toEqual([]);
  });
});
