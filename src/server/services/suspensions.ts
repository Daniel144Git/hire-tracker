import { db } from "@/server/db";
import { suspensionCreateSchema } from "@/lib/schemas/suspension";
import { recheckRelatedInvoices } from "./reconciliation";
import { getSite } from "./sites";

export interface SuspensionDto {
  id: string;
  siteId: string;
  periodFrom: string;
  periodTo: string;
  freeDays: number;
  note: string | null;
}

function toDto(row: SuspensionDto & { createdAt?: Date }): SuspensionDto {
  return {
    id: row.id,
    siteId: row.siteId,
    periodFrom: row.periodFrom,
    periodTo: row.periodTo,
    freeDays: row.freeDays,
    note: row.note,
  };
}

export async function listSuspensions(siteId: string): Promise<SuspensionDto[]> {
  await getSite(siteId);
  const rows = await db.suspension.findMany({ where: { siteId }, orderBy: { periodFrom: "desc" } });
  return rows.map(toDto);
}

/** Records a suspension, then re-checks the invoices of the site's orders (R16). */
export async function createSuspension(siteId: string, body: unknown): Promise<SuspensionDto> {
  const input = suspensionCreateSchema.parse(body);
  await getSite(siteId);
  const suspension = await db.suspension.create({ data: { ...input, siteId } });
  const orders = await db.hireOrder.findMany({ where: { siteId }, select: { id: true } });
  await recheckRelatedInvoices({ orderIds: orders.map((order) => order.id) });
  return toDto(suspension);
}
