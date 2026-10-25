import { db } from "@/server/db";
import { serviceEventCreateSchema } from "@/lib/schemas/service-event";
import { checkInvoice } from "./reconciliation";
import { getSite } from "./sites";

export interface ServiceEventDto {
  id: string;
  siteId: string;
  date: string;
  kind: "SERVICE" | "INSPECTION" | "REPAIR" | "DAMAGE" | "LOSS";
  fleetCode: string | null;
  description: string;
  confirmedBy: string | null;
}

function toDto(event: ServiceEventDto): ServiceEventDto {
  return {
    id: event.id,
    siteId: event.siteId,
    date: event.date,
    kind: event.kind,
    fleetCode: event.fleetCode,
    description: event.description,
    confirmedBy: event.confirmedBy,
  };
}

export async function listServiceEvents(siteId: string): Promise<ServiceEventDto[]> {
  await getSite(siteId);
  const events = await db.serviceEvent.findMany({ where: { siteId }, orderBy: { date: "desc" } });
  return events.map(toDto);
}

/**
 * Records a service, inspection, repair, damage or loss on site, then re-checks the site's
 * invoices: a charge that was waiting for it (R9) is matched now.
 */
export async function createServiceEvent(siteId: string, body: unknown): Promise<ServiceEventDto> {
  const input = serviceEventCreateSchema.parse(body);
  await getSite(siteId);
  const event = await db.serviceEvent.create({ data: { ...input, siteId } });
  const invoices = await db.invoice.findMany({
    where: { OR: [{ siteId }, { lines: { some: { order: { siteId } } } }] },
    select: { id: true },
  });
  for (const invoice of invoices) await checkInvoice(invoice.id);
  return toDto(event);
}
