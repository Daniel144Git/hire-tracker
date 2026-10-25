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

/**
 * A continuation invoice for one order: one hire line for its first item and a 10% damage
 * waiver line. August 2026 at £50.00/week is 4 wks 1 day = £210.00 (the brief's example).
 */
export function invoiceData(
  ids: { supplierId: string; jobNo?: string; fleetCode?: string | null },
  overrides: Record<string, unknown> = {},
) {
  return {
    supplierId: ids.supplierId,
    number: `INV-${uniqueCode(8)}`,
    date: "2026-08-31",
    type: "CONTINUATION",
    jobNo: ids.jobNo,
    net: 231,
    vat: 46.2,
    gross: 277.2,
    lines: [
      {
        description: "Scissor lift 19ft electric",
        fleetCode: ids.fleetCode ?? undefined,
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        weeks: 4,
        days: 1,
        rate: 50,
        chargeType: "HIRE",
        net: 210,
        vat: 42,
      },
      { description: "Damage waiver 10%", chargeType: "DAMAGE_WAIVER", net: 21, vat: 4.2 },
    ],
    ...overrides,
  };
}

/**
 * A random month far in the future, e.g. "2417-03", so a report test sees only its own
 * invoices even when tests run in parallel or repeat.
 */
export function uniqueMonth(): string {
  const [a, b] = randomBytes(2);
  return `${2100 + ((a * 256 + b) % 800)}-${String((a % 12) + 1).padStart(2, "0")}`;
}

/** July 2026 for one item at £50.00/week: 23 working days = 4 wks 3 days = £230.00. */
export function julyLine(
  fleetCode: string | null | undefined,
  overrides: Record<string, unknown> = {},
) {
  return {
    description: "Scissor lift 19ft electric",
    fleetCode: fleetCode ?? undefined,
    periodFrom: "2026-07-01",
    periodTo: "2026-07-31",
    chargeType: "HIRE",
    net: 230,
    vat: 46,
    ...overrides,
  };
}
