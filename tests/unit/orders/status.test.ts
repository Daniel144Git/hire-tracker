import { describe, expect, it } from "vitest";
import { OrderRuleError, planCollection, planOffHire } from "@/lib/orders/status";

const onHire = { status: "ON_HIRE" as const, startDate: "2026-08-03" };

describe("planOffHire: ON_HIRE -> OFF_HIRED, or straight to COLLECTED", () => {
  it("off-hires an item on hire and records the date", () => {
    expect(planOffHire(onHire, { offHireDate: "2026-08-12" })).toEqual({
      status: "OFF_HIRED",
      offHireDate: "2026-08-12",
      collectionNo: null,
    });
  });

  it("goes straight to COLLECTED when the collection number is already known", () => {
    expect(planOffHire(onHire, { offHireDate: "2026-08-12", collectionNo: "C-5521" })).toEqual({
      status: "COLLECTED",
      offHireDate: "2026-08-12",
      collectionNo: "C-5521",
    });
  });

  it("allows off-hire on the start day itself", () => {
    expect(planOffHire(onHire, { offHireDate: "2026-08-03" }).offHireDate).toBe("2026-08-03");
  });

  it("rejects an off-hire date before the start of hire", () => {
    expect(() => planOffHire(onHire, { offHireDate: "2026-08-02" })).toThrow(
      expect.objectContaining({ code: "OFF_HIRE_BEFORE_START" }),
    );
  });

  it.each(["OFF_HIRED", "COLLECTED"] as const)(
    "rejects off-hiring an order that is already %s",
    (status) => {
      expect(() => planOffHire({ ...onHire, status }, { offHireDate: "2026-08-12" })).toThrow(
        OrderRuleError,
      );
      expect(() => planOffHire({ ...onHire, status }, { offHireDate: "2026-08-12" })).toThrow(
        expect.objectContaining({ code: "ORDER_NOT_ON_HIRE" }),
      );
    },
  );
});

describe("planCollection: OFF_HIRED -> COLLECTED", () => {
  it("records the collection number of an off-hired order", () => {
    expect(planCollection({ status: "OFF_HIRED" }, { collectionNo: "C-5521" })).toEqual({
      status: "COLLECTED",
      collectionNo: "C-5521",
    });
  });

  it.each(["ON_HIRE", "COLLECTED"] as const)(
    "rejects recording a collection for an order that is %s",
    (status) => {
      expect(() => planCollection({ status }, { collectionNo: "C-5521" })).toThrow(
        expect.objectContaining({ code: "ORDER_NOT_OFF_HIRED" }),
      );
    },
  );
});
