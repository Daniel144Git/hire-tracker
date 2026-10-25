import { db } from "@/server/db";
import { ConflictError, NotFoundError } from "@/server/errors";
import { siteCreateSchema, siteUpdateSchema } from "@/lib/schemas/site";

export interface SiteDto {
  id: string;
  code: string;
  name: string;
  deliveryAddress: string | null;
  /** Hire orders on this site that are still ON_HIRE. */
  ordersOnHire: number;
}

const withOnHireCount = {
  _count: { select: { orders: { where: { status: "ON_HIRE" as const } } } },
};

type SiteRow = {
  id: string;
  code: string;
  name: string;
  deliveryAddress: string | null;
  _count: { orders: number };
};

function toDto(site: SiteRow): SiteDto {
  return {
    id: site.id,
    code: site.code,
    name: site.name,
    deliveryAddress: site.deliveryAddress,
    ordersOnHire: site._count.orders,
  };
}

export async function listSites(): Promise<SiteDto[]> {
  const sites = await db.site.findMany({ orderBy: { code: "asc" }, include: withOnHireCount });
  return sites.map(toDto);
}

export async function getSite(id: string): Promise<SiteDto> {
  const site = await db.site.findUnique({ where: { id }, include: withOnHireCount });
  if (!site) throw new NotFoundError("Site", id);
  return toDto(site);
}

export async function createSite(body: unknown): Promise<SiteDto> {
  const input = siteCreateSchema.parse(body);
  await assertCodeIsFree(input.code);
  return toDto(await db.site.create({ data: input, include: withOnHireCount }));
}

export async function updateSite(id: string, body: unknown): Promise<SiteDto> {
  const input = siteUpdateSchema.parse(body);
  await getSite(id);
  if (input.code) await assertCodeIsFree(input.code, id);
  return toDto(await db.site.update({ where: { id }, data: input, include: withOnHireCount }));
}

async function assertCodeIsFree(code: string, exceptId?: string): Promise<void> {
  const existing = await db.site.findUnique({ where: { code } });
  if (existing && existing.id !== exceptId) {
    throw new ConflictError(`Site code ${code} is already used`, "DUPLICATE_SITE_CODE");
  }
}
