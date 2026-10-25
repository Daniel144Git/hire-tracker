import { parseIsoDate, type IsoDate } from "@/lib/charging/iso-date";

export type OrderStatus = "ON_HIRE" | "OFF_HIRED" | "COLLECTED";

export type OrderRuleCode = "ORDER_NOT_ON_HIRE" | "ORDER_NOT_OFF_HIRED" | "OFF_HIRE_BEFORE_START";

/** A request that is well-formed but breaks a business rule for the order's current state. */
export class OrderRuleError extends Error {
  constructor(
    readonly code: OrderRuleCode,
    message: string,
  ) {
    super(message);
    this.name = "OrderRuleError";
  }
}

/**
 * Off-hire: ON_HIRE -> OFF_HIRED, or straight to COLLECTED when the collection number is
 * already known. The off-hire date drives every "billed after end of hire" check, so it can
 * only be set once and never before the start of hire.
 */
export function planOffHire(
  order: { status: OrderStatus; startDate: IsoDate },
  input: { offHireDate: IsoDate; collectionNo?: string },
): { status: OrderStatus; offHireDate: IsoDate; collectionNo: string | null } {
  if (order.status !== "ON_HIRE") {
    throw new OrderRuleError("ORDER_NOT_ON_HIRE", `The order is already ${order.status}`);
  }
  if (parseIsoDate(input.offHireDate) < parseIsoDate(order.startDate)) {
    throw new OrderRuleError(
      "OFF_HIRE_BEFORE_START",
      `Off-hire date ${input.offHireDate} is before the start of hire ${order.startDate}`,
    );
  }
  return {
    status: input.collectionNo ? "COLLECTED" : "OFF_HIRED",
    offHireDate: input.offHireDate,
    collectionNo: input.collectionNo ?? null,
  };
}

/** Collection: OFF_HIRED -> COLLECTED, recording the supplier's collection number. */
export function planCollection(
  order: { status: OrderStatus },
  input: { collectionNo: string },
): { status: "COLLECTED"; collectionNo: string } {
  if (order.status !== "OFF_HIRED") {
    throw new OrderRuleError(
      "ORDER_NOT_OFF_HIRED",
      `Only an off-hired order can be collected; this order is ${order.status}`,
    );
  }
  return { status: "COLLECTED", collectionNo: input.collectionNo };
}
