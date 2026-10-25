import type {
  CheckInvoice,
  CheckLine,
  CheckOrder,
  ReconciliationContext,
} from "@/lib/reconciliation/types";

// Test data builders: each returns a valid default (the brief's example: a scissor lift at
// £50.00/week on job J100101, billed for August 2026), and a test overrides only what it is about.

export function order(overrides: Partial<CheckOrder> = {}): CheckOrder {
  return {
    id: "order-1",
    supplierJobNo: "J100101",
    startDate: "2026-07-01",
    offHireDate: null,
    damageWaiverApplies: true,
    items: [{ id: "item-1", fleetCode: "APX-SL-1042", weeklyRate: 50 }],
    ...overrides,
  };
}

/** August 2026 for the scissor lift: 21 working days = 4 wks 1 day = £210.00. */
export function hireLine(overrides: Partial<CheckLine> = {}): CheckLine {
  return {
    id: "line-1",
    position: 1,
    description: "Scissor lift 19ft electric",
    fleetCode: "APX-SL-1042",
    qty: 1,
    periodFrom: "2026-08-01",
    periodTo: "2026-08-31",
    chargeType: "HIRE",
    net: 210,
    vat: 42,
    orderId: "order-1",
    hireItemId: "item-1",
    ...overrides,
  };
}

export function line(overrides: Partial<CheckLine> & Pick<CheckLine, "chargeType" | "net">) {
  return hireLine({
    id: `line-${overrides.chargeType.toLowerCase()}`,
    position: 2,
    description: overrides.chargeType,
    fleetCode: null,
    periodFrom: null,
    periodTo: null,
    hireItemId: null,
    vat: Math.round(overrides.net * 20) / 100,
    ...overrides,
  });
}

/** An invoice whose header totals are the sums of its lines, unless given. */
export function invoice(overrides: Partial<CheckInvoice> = {}): CheckInvoice {
  const lines = overrides.lines ?? [hireLine()];
  const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
  const net = overrides.net ?? sum(lines.map((l) => l.net));
  const vat = overrides.vat ?? sum(lines.map((l) => l.vat));
  return {
    id: "invoice-1",
    number: "INV-20817",
    date: "2026-08-31",
    type: "CONTINUATION",
    isCreditNote: false,
    gross: sum([net, vat]),
    ...overrides,
    lines,
    net,
    vat,
  };
}

export function context(
  overrides: {
    invoice?: CheckInvoice;
    orders?: CheckOrder[];
    otherInvoices?: CheckInvoice[];
    rules?: Partial<ReconciliationContext["rules"]>;
    tolerance?: number;
  } = {},
): ReconciliationContext {
  const orders = overrides.orders ?? [order()];
  return {
    invoice: overrides.invoice ?? invoice(),
    orders: Object.fromEntries(orders.map((o) => [o.id, o])),
    otherInvoices: overrides.otherInvoices ?? [],
    rules: {
      chargeBankHolidays: true,
      bankHolidays: ["2026-08-31"],
      minChargeDays: 5,
      damageWaiverPct: 10,
      ...overrides.rules,
    },
    tolerance: overrides.tolerance ?? 0.05,
    vatRate: 0.2,
  };
}
