import { db } from "@/server/db";
import { fromPence, round2 } from "@/lib/money";
import { buildOnHireRegister } from "@/lib/register/on-hire-register";
import { asOfQuerySchema, today } from "@/lib/schemas/as-of";
import { chargingRulesOf } from "./reconciliation";
import { getSite } from "./sites";

/** GET /api/sites/:id/on-hire: the site's on-hire register as of a date (default today). */
export async function getOnHireRegister(siteId: string, query: unknown = {}) {
  const { asOf = today() } = asOfQuerySchema.parse(query);
  const site = await getSite(siteId);

  const orders = await db.hireOrder.findMany({
    where: { siteId, status: { in: ["ON_HIRE", "OFF_HIRED"] } },
    include: {
      supplier: true,
      items: { orderBy: [{ isAccessory: "asc" }, { createdAt: "asc" }] },
      invoiceLines: {
        where: { chargeType: "HIRE", hireItemId: { not: null } },
        select: { hireItemId: true, netPence: true },
      },
    },
  });

  const rows = buildOnHireRegister(
    orders.map((order) => ({
      id: order.id,
      supplierJobNo: order.supplierJobNo,
      supplierName: order.supplier.name,
      trade: order.trade,
      status: order.status,
      startDate: order.startDate,
      offHireDate: order.offHireDate,
      rules: chargingRulesOf(order.supplier),
      items: order.items.map((item) => ({
        id: item.id,
        description: item.description,
        fleetCode: item.fleetCode,
        qty: item.qty,
        weeklyRate: fromPence(item.weeklyRatePence),
      })),
    })),
    orders.flatMap((order) =>
      order.invoiceLines.map((line) => ({
        hireItemId: line.hireItemId as string,
        net: fromPence(line.netPence),
      })),
    ),
    asOf,
  );

  const sum = (pick: (row: (typeof rows)[number]) => number) =>
    round2(rows.reduce((total, row) => total + pick(row), 0));
  return {
    site: { id: site.id, code: site.code, name: site.name },
    asOf,
    rows,
    totals: {
      items: rows.length,
      costToDate: sum((row) => row.costToDate),
      billedToDate: sum((row) => row.billedToDate),
      notYetBilled: sum((row) => row.notYetBilled),
    },
  };
}

export type OnHireRegister = Awaited<ReturnType<typeof getOnHireRegister>>;
