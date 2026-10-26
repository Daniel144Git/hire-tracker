import { z } from "zod";
import { db } from "@/server/db";
import { DEFAULT_ALERT_SETTINGS, hireAlerts } from "@/lib/register/alerts";
import { isoDateSchema } from "@/lib/schemas/common";
import { optionalId } from "@/lib/schemas/filters";
import { today } from "@/lib/schemas/as-of";
import { getOnHireRegister } from "./register";

export const alertsQuerySchema = z.strictObject({
  asOf: isoDateSchema.optional(),
  supplierId: optionalId,
  siteId: optionalId,
  longHireDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(3650)
    .default(DEFAULT_ALERT_SETTINGS.longHireDays),
  costLimit: z.coerce.number().min(0).max(10_000_000).default(DEFAULT_ALERT_SETTINGS.costLimit),
  collectionDays: z.coerce
    .number()
    .int()
    .min(0)
    .max(365)
    .default(DEFAULT_ALERT_SETTINGS.collectionDays),
});

/** GET /api/alerts: long hires, costly hires and items not collected, on every site. */
export async function getHireAlerts(query: unknown = {}) {
  const { asOf = today(), supplierId, siteId, ...settings } = alertsQuerySchema.parse(query);
  const sites = await db.site.findMany({
    where: { id: siteId },
    select: { id: true },
    orderBy: { code: "asc" },
  });
  const supplier = supplierId
    ? await db.supplier.findUnique({ where: { id: supplierId }, select: { name: true } })
    : null;
  const registers = await Promise.all(sites.map((site) => getOnHireRegister(site.id, { asOf })));
  const rows = registers.flatMap((register) =>
    register.rows
      // Supplier names are unique, and the register rows carry the name.
      .filter((row) => !supplierId || row.supplierName === supplier?.name)
      .map((row) => ({ ...row, site: register.site })),
  );
  return { asOf, settings, alerts: hireAlerts(rows, asOf, settings) };
}
