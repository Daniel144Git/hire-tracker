import { describe, expect, it } from "vitest";
import { rateInconsistency } from "@/lib/reconciliation/checks/r12-rate-inconsistency";
import { context, hireLine, invoice, order } from "./builders";

const adaptor = order({
  items: [
    { id: "item-1", description: "Outrigger adaptor", fleetCode: "APX-AD-0021", weeklyRate: 3.75 },
  ],
});
const adaptorLine = invoice({
  lines: [
    hireLine({ description: "Outrigger adaptor", fleetCode: "APX-AD-0021", net: 15.75, vat: 3.15 }),
  ],
});

function otherOrderItem(description: string, weeklyRate: number) {
  return { orderId: "order-2", supplierJobNo: "J100102", description, weeklyRate };
}

describe("R12: the same item type hired at different rates on different orders", () => {
  it("flags an item hired at another weekly rate on another order", () => {
    const ctx = context({
      orders: [adaptor],
      invoice: adaptorLine,
      supplierItems: [
        {
          orderId: "order-1",
          supplierJobNo: "J100101",
          description: "Outrigger adaptor",
          weeklyRate: 3.75,
        },
        otherOrderItem("Outrigger adaptor", 3.5),
      ],
    });

    expect(rateInconsistency(ctx)).toEqual([
      expect.objectContaining({
        check: "R12",
        severity: "LOW",
        invoiceLineId: "line-1",
        message: "Outrigger adaptor is hired at £3.75/week here but at £3.50/week on job J100102",
      }),
    ]);
  });

  it("matches descriptions whatever their case and spacing", () => {
    const ctx = context({
      orders: [adaptor],
      invoice: adaptorLine,
      supplierItems: [otherOrderItem("  OUTRIGGER   adaptor ", 3.5)],
    });

    expect(rateInconsistency(ctx)).toHaveLength(1);
  });

  it("does not flag the same rate, or a difference within the tolerance", () => {
    for (const rate of [3.75, 3.79]) {
      const ctx = context({
        orders: [adaptor],
        invoice: adaptorLine,
        supplierItems: [otherOrderItem("Outrigger adaptor", rate)],
      });
      expect(rateInconsistency(ctx)).toEqual([]);
    }
  });

  it("does not compare different item types", () => {
    const ctx = context({ supplierItems: [otherOrderItem("Mobile platform 3m", 35)] });

    expect(rateInconsistency(ctx)).toEqual([]);
  });

  it("does not compare items of the same order", () => {
    const ctx = context({
      orders: [adaptor],
      invoice: adaptorLine,
      supplierItems: [
        {
          orderId: "order-1",
          supplierJobNo: "J100101",
          description: "Outrigger adaptor",
          weeklyRate: 3.5,
        },
      ],
    });

    expect(rateInconsistency(ctx)).toEqual([]);
  });
});
