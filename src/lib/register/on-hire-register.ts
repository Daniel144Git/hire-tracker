import { expectedHireCharge, type ChargingRules } from "@/lib/charging/hire-charge";
import { MS_PER_DAY, parseIsoDate, type IsoDate } from "@/lib/charging/iso-date";
import { countChargeableDays } from "@/lib/charging/working-days";
import { fromPence, round2, toPence } from "@/lib/money";

type OrderStatus = "ON_HIRE" | "OFF_HIRED" | "COLLECTED";

export interface RegisterOrder {
  id: string;
  supplierJobNo: string;
  supplierName: string;
  trade: string;
  status: OrderStatus;
  startDate: IsoDate;
  offHireDate: IsoDate | null;
  /** The supplier's charging rules: each supplier can charge differently. */
  rules: ChargingRules;
  items: {
    id: string;
    description: string;
    fleetCode: string | null;
    qty: number;
    weeklyRate: number;
  }[];
}

/** A hire line billed for an item; negative for credits. */
export interface BilledLine {
  hireItemId: string;
  net: number;
}

export interface RegisterRow {
  orderId: string;
  supplierJobNo: string;
  supplierName: string;
  trade: string;
  status: OrderStatus;
  itemId: string;
  description: string;
  fleetCode: string | null;
  qty: number;
  weeklyRate: number;
  startDate: IsoDate;
  offHireDate: IsoDate | null;
  calendarDaysOnHire: number;
  chargeableDays: number;
  /** What the hire has cost so far at the agreed rate. */
  costToDate: number;
  /** What the supplier has billed for the item so far, credits included. */
  billedToDate: number;
  /** costToDate - billedToDate: negative when more was billed than the hire cost. */
  notYetBilled: number;
}

/**
 * The on-hire register: every item still on site (on hire, or off-hired and waiting for
 * collection), since when, and what it has cost up to `asOf` (or its off-hire date) at the
 * agreed rate, next to what was billed for it. `asOf` is a parameter, not "today", so the
 * register can be tested and looked at for any date.
 */
export function buildOnHireRegister(
  orders: RegisterOrder[],
  billed: BilledLine[],
  asOf: IsoDate,
): RegisterRow[] {
  const billedPence = new Map<string, number>();
  for (const line of billed) {
    billedPence.set(line.hireItemId, (billedPence.get(line.hireItemId) ?? 0) + toPence(line.net));
  }

  return orders
    .filter((order) => order.status !== "COLLECTED")
    .sort(
      (a, b) =>
        parseIsoDate(a.startDate) - parseIsoDate(b.startDate) ||
        a.supplierJobNo.localeCompare(b.supplierJobNo),
    )
    .flatMap((order) => {
      const end =
        order.offHireDate && parseIsoDate(order.offHireDate) < parseIsoDate(asOf)
          ? order.offHireDate
          : asOf;
      const started = parseIsoDate(order.startDate) <= parseIsoDate(end);
      const calendarDaysOnHire = started
        ? (parseIsoDate(end) - parseIsoDate(order.startDate)) / MS_PER_DAY + 1
        : 0;
      const chargeableDays = started ? countChargeableDays(order.startDate, end, order.rules) : 0;

      return order.items.map((item) => {
        const costToDate = started
          ? expectedHireCharge({
              weeklyRate: item.weeklyRate,
              qty: item.qty,
              period: { from: order.startDate, to: end },
              hire: { start: order.startDate, offHire: order.offHireDate ?? undefined },
              rules: order.rules,
            }).total
          : 0;
        const billedToDate = fromPence(billedPence.get(item.id) ?? 0);
        return {
          orderId: order.id,
          supplierJobNo: order.supplierJobNo,
          supplierName: order.supplierName,
          trade: order.trade,
          status: order.status,
          itemId: item.id,
          description: item.description,
          fleetCode: item.fleetCode,
          qty: item.qty,
          weeklyRate: item.weeklyRate,
          startDate: order.startDate,
          offHireDate: order.offHireDate,
          calendarDaysOnHire,
          chargeableDays,
          costToDate,
          billedToDate,
          notYetBilled: round2(costToDate - billedToDate),
        };
      });
    });
}
