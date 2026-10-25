import { randomBytes } from "node:crypto";

const ALPHANUMERIC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A random upper-case code, e.g. "K7QZ3M". Unique data lets tests run in parallel and alone. */
export function uniqueCode(length = 6): string {
  return Array.from(randomBytes(length), (byte) => ALPHANUMERIC[byte % ALPHANUMERIC.length]).join(
    "",
  );
}

export function siteData(overrides: Record<string, unknown> = {}) {
  return { code: uniqueCode(), name: `Test Site ${uniqueCode(4)}`, ...overrides };
}

export function supplierData(overrides: Record<string, unknown> = {}) {
  return { name: `Test Plant Hire ${uniqueCode(8)}`, ...overrides };
}

export function itemData(overrides: Record<string, unknown> = {}) {
  return {
    description: "Scissor lift 19ft electric",
    fleetCode: `APX-SL-${uniqueCode(4)}`,
    weeklyRate: 50,
    ...overrides,
  };
}

export function orderData(
  ids: { supplierId: string; siteId: string },
  overrides: Record<string, unknown> = {},
) {
  return {
    ...ids,
    supplierJobNo: `J${uniqueCode(7)}`,
    trade: "MECH",
    startDate: "2026-08-03",
    items: [itemData()],
    ...overrides,
  };
}
