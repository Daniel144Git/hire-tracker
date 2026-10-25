import { describe, expect, it } from "vitest";
import { linkInvoiceLine, type OrderForLinking } from "@/lib/invoices/link-line";

const orders: OrderForLinking[] = [
  {
    id: "order-1",
    supplierJobNo: "J100101",
    orderRef: null,
    items: [
      { id: "item-lift", fleetCode: "APX-SL-1042" },
      { id: "item-groover", fleetCode: "APX-PG-0317" },
    ],
  },
  {
    id: "order-2",
    supplierJobNo: "J100102",
    orderRef: null,
    items: [
      { id: "item-platform", fleetCode: "APX-MP-0588" },
      { id: "item-no-fleet-code", fleetCode: null },
    ],
  },
  {
    // The same fleet code on two orders: an item hired, returned, then hired again.
    id: "order-3",
    supplierJobNo: "J100103",
    orderRef: null,
    items: [{ id: "item-lift-again", fleetCode: "APX-SL-1042" }],
  },
];

describe("linkInvoiceLine: our order number and fleet code changes", () => {
  const withRefs: OrderForLinking[] = [
    { ...orders[0], orderRef: "PO-1001" },
    {
      ...orders[1],
      orderRef: "PO-1002",
      items: [
        { id: "item-platform", fleetCode: "APX-MP-0600", previousFleetCodes: ["APX-MP-0588"] },
      ],
    },
  ];

  it("links by our order number ('Our ref') before the job number", () => {
    expect(linkInvoiceLine({}, { orderRef: "PO-1002", jobNo: "J100101" }, withRefs)).toEqual({
      orderId: "order-2",
      hireItemId: null,
      problem: null,
    });
  });

  it("falls back to the job number when our order number is on no order", () => {
    expect(linkInvoiceLine({}, { orderRef: "PO-9999", jobNo: "J100101" }, withRefs)).toEqual({
      orderId: "order-1",
      hireItemId: null,
      problem: null,
    });
  });

  it("reports our order number when neither reference is on an order", () => {
    expect(linkInvoiceLine({}, { orderRef: "PO-9999", jobNo: "J999999" }, withRefs).problem).toBe(
      "UNKNOWN_ORDER_REF",
    );
  });

  it("links a line billed with an item's previous fleet code to that item", () => {
    expect(
      linkInvoiceLine({ fleetCode: "APX-MP-0588" }, { orderRef: "PO-1002" }, withRefs),
    ).toEqual({
      orderId: "order-2",
      hireItemId: "item-platform",
      problem: null,
    });
  });
});

describe("linkInvoiceLine: links a line to a hire order and item", () => {
  it("links by fleet code within the invoice's job number", () => {
    expect(linkInvoiceLine({ fleetCode: "APX-PG-0317" }, { jobNo: "J100101" }, orders)).toEqual({
      orderId: "order-1",
      hireItemId: "item-groover",
      problem: null,
    });
  });

  it("prefers the invoice's job when the same fleet code is on more than one order", () => {
    expect(linkInvoiceLine({ fleetCode: "APX-SL-1042" }, { jobNo: "J100103" }, orders)).toEqual({
      orderId: "order-3",
      hireItemId: "item-lift-again",
      problem: null,
    });
  });

  it("links by fleet code alone when it is on exactly one order, even under another job", () => {
    expect(linkInvoiceLine({ fleetCode: "APX-MP-0588" }, { jobNo: "J100101" }, orders)).toEqual({
      orderId: "order-2",
      hireItemId: "item-platform",
      problem: null,
    });
  });

  it("links a line without a fleet code (damage waiver, transport) to the job's order", () => {
    expect(linkInvoiceLine({}, { jobNo: "J100102" }, orders)).toEqual({
      orderId: "order-2",
      hireItemId: null,
      problem: null,
    });
  });

  it("reports a fleet code that is on no order, and keeps the job's order", () => {
    expect(linkInvoiceLine({ fleetCode: "APX-XX-9999" }, { jobNo: "J100101" }, orders)).toEqual({
      orderId: "order-1",
      hireItemId: null,
      problem: "UNKNOWN_FLEET_CODE",
    });
  });

  it("reports a fleet code on several orders when the job does not decide", () => {
    expect(linkInvoiceLine({ fleetCode: "APX-SL-1042" }, {}, orders)).toEqual({
      orderId: null,
      hireItemId: null,
      problem: "AMBIGUOUS_FLEET_CODE",
    });
  });

  it("reports a job number that matches no order", () => {
    expect(linkInvoiceLine({}, { jobNo: "J999999" }, orders)).toEqual({
      orderId: null,
      hireItemId: null,
      problem: "UNKNOWN_JOB_NO",
    });
  });

  it("leaves a line unlinked without a problem when there is neither job nor fleet code", () => {
    expect(linkInvoiceLine({}, {}, orders)).toEqual({
      orderId: null,
      hireItemId: null,
      problem: null,
    });
  });
});
