import { describe, expect, it } from "vitest";
import {
  collectionSchema,
  hireItemSchema,
  offHireSchema,
  orderCreateSchema,
  orderUpdateSchema,
} from "@/lib/schemas/order";

const validItem = {
  description: "Scissor lift 19ft electric",
  fleetCode: "apx-sl-1042",
  weeklyRate: 50,
};

const validOrder = {
  supplierId: "supplier-1",
  siteId: "site-1",
  supplierJobNo: " j100101 ",
  trade: "MECH",
  startDate: "2026-08-13",
  items: [validItem],
};

describe("hireItemSchema", () => {
  it("defaults the quantity to 1 and accessory to false, and upper-cases the fleet code", () => {
    expect(hireItemSchema.parse(validItem)).toEqual({
      description: "Scissor lift 19ft electric",
      fleetCode: "APX-SL-1042",
      weeklyRate: 50,
      qty: 1,
      isAccessory: false,
    });
  });

  it("accepts a line of identical items without a fleet code", () => {
    const result = hireItemSchema.parse({ description: "Scissor lift", qty: 4, weeklyRate: 50 });
    expect(result.fleetCode).toBeUndefined();
    expect(result.qty).toBe(4);
  });

  it.each([
    ["negative", -1],
    ["with fractions of a penny", 41.295],
    ["not a number", "50"],
  ])("rejects a weekly rate that is %s", (_case, weeklyRate) => {
    expect(hireItemSchema.safeParse({ ...validItem, weeklyRate }).success).toBe(false);
  });

  it.each([0, -2, 1.5])("rejects a quantity of %s", (qty) => {
    expect(hireItemSchema.safeParse({ ...validItem, qty }).success).toBe(false);
  });

  it("rejects a despatch date that does not exist", () => {
    expect(hireItemSchema.safeParse({ ...validItem, despatchDate: "2026-02-30" }).success).toBe(
      false,
    );
  });
});

describe("orderCreateSchema", () => {
  it("accepts a valid order and normalises the job number", () => {
    const result = orderCreateSchema.parse(validOrder);
    expect(result.supplierJobNo).toBe("J100101");
    expect(result.items).toHaveLength(1);
  });

  it("leaves damageWaiverApplies out when not given, so the supplier's setting decides", () => {
    expect(orderCreateSchema.parse(validOrder).damageWaiverApplies).toBeUndefined();
  });

  it("rejects an order with no items", () => {
    expect(orderCreateSchema.safeParse({ ...validOrder, items: [] }).success).toBe(false);
  });

  it("rejects a trade that is not configured", () => {
    expect(orderCreateSchema.safeParse({ ...validOrder, trade: "PLUMBING" }).success).toBe(false);
  });

  it.each(["13/08/2026", "2026-8-13", "2026-02-29"])("rejects a start date of %s", (startDate) => {
    expect(orderCreateSchema.safeParse({ ...validOrder, startDate }).success).toBe(false);
  });

  it("reports the path of an invalid field inside an item", () => {
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      items: [{ ...validItem, weeklyRate: -1 }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["items", 0, "weeklyRate"]);
  });
});

describe("orderUpdateSchema", () => {
  it("accepts a change of trade", () => {
    expect(orderUpdateSchema.parse({ trade: "ELEC" })).toEqual({ trade: "ELEC" });
  });

  it("does not allow the status or dates to be changed directly", () => {
    expect(orderUpdateSchema.safeParse({ status: "COLLECTED" }).success).toBe(false);
    expect(orderUpdateSchema.safeParse({ offHireDate: "2026-08-20" }).success).toBe(false);
  });

  it("rejects an update with no fields", () => {
    expect(orderUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("offHireSchema and collectionSchema", () => {
  it("accepts an off-hire date with or without a collection number", () => {
    expect(offHireSchema.parse({ offHireDate: "2026-08-20" })).toEqual({
      offHireDate: "2026-08-20",
    });
    expect(offHireSchema.parse({ offHireDate: "2026-08-20", collectionNo: " c-5521 " })).toEqual({
      offHireDate: "2026-08-20",
      collectionNo: "C-5521",
    });
  });

  it("requires a collection number to record a collection", () => {
    expect(collectionSchema.safeParse({}).success).toBe(false);
    expect(collectionSchema.safeParse({ collectionNo: " " }).success).toBe(false);
  });
});
