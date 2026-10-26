import { describe, expect, it } from "vitest";
import { rateInconsistency } from "@/lib/reconciliation/checks/r12-rate-inconsistency";
import type { SupplierItem } from "@/lib/reconciliation/types";
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

function otherOrderItem(
  description: string,
  weeklyRate: number,
  overrides: Partial<SupplierItem> = {},
): SupplierItem {
  return {
    orderId: "order-2",
    supplierJobNo: "J100102",
    description,
    weeklyRate,
    fleetCode: "APX-AD-0099",
    qty: 1,
    orderStartDate: "2026-07-01",
    ...overrides,
  };
}

describe("R12: the same item type hired at different rates on different orders", () => {
  it("flags an item hired at another weekly rate on another order", () => {
    const ctx = context({
      orders: [adaptor],
      invoice: adaptorLine,
      supplierItems: [
        otherOrderItem("Outrigger adaptor", 3.75, { orderId: "order-1", supplierJobNo: "J100101" }),
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
        otherOrderItem("Outrigger adaptor", 3.5, { orderId: "order-1", supplierJobNo: "J100101" }),
      ],
    });

    expect(rateInconsistency(ctx)).toEqual([]);
  });

  // Only the same product, hired one at a time, at about the same time is comparable.
  it("does not compare with an item without a fleet code: it may not be the same product", () => {
    const ctx = context({
      orders: [adaptor],
      invoice: adaptorLine,
      supplierItems: [otherOrderItem("Outrigger adaptor", 3.5, { fleetCode: null })],
    });

    expect(rateInconsistency(ctx)).toEqual([]);
  });

  it("does not compare items hired several at a time", () => {
    const several = otherOrderItem("Outrigger adaptor", 3.5, { qty: 10 });
    expect(
      rateInconsistency(
        context({ orders: [adaptor], invoice: adaptorLine, supplierItems: [several] }),
      ),
    ).toEqual([]);

    const ownLineOfTwo = invoice({
      lines: [{ ...adaptorLine.lines[0], qty: 2, net: 31.5, vat: 6.3 }],
    });
    expect(
      rateInconsistency(
        context({
          orders: [adaptor],
          invoice: ownLineOfTwo,
          supplierItems: [otherOrderItem("Outrigger adaptor", 3.5)],
        }),
      ),
    ).toEqual([]);
  });

  it.each([
    ["six months earlier", "2026-01-01", 1],
    ["more than six months earlier", "2025-12-29", 0],
    ["six months later", "2026-12-31", 1],
    ["more than six months later", "2027-01-02", 0],
  ])("compares with an order started %s: %s finding(s)", (_when, orderStartDate, count) => {
    const ctx = context({
      orders: [adaptor],
      invoice: adaptorLine,
      supplierItems: [otherOrderItem("Outrigger adaptor", 3.5, { orderStartDate })],
    });

    expect(rateInconsistency(ctx)).toHaveLength(count);
  });

  it("reports an item once, on the first invoice that bills it", () => {
    const earlier = invoice({
      id: "earlier",
      number: "INV-20700",
      date: "2026-07-31",
      lines: [hireLine({ id: "old", fleetCode: "APX-AD-0021" })],
    });
    const ctx = context({
      orders: [adaptor],
      invoice: adaptorLine,
      otherInvoices: [earlier],
      supplierItems: [otherOrderItem("Outrigger adaptor", 3.5)],
    });

    expect(rateInconsistency(ctx)).toEqual([]);
  });
});
