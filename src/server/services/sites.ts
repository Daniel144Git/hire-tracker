import { db } from "@/server/db";
import { ConflictError, NotFoundError } from "@/server/errors";
import {
  recognizeSiteQuerySchema,
  siteAliasesSchema,
  siteCreateSchema,
  siteUpdateSchema,
} from "@/lib/schemas/site";
import { normaliseReference, recognizeSite } from "@/lib/sites/recognize-site";
import { refreshRecognisedSites } from "./linking";

export interface SiteDto {
  id: string;
  code: string;
  name: string;
  deliveryAddress: string | null;
  /** Hire orders on this site that are still ON_HIRE. */
  ordersOnHire: number;
  /** Customer references the supplier uses for the site, normalised. */
  aliases: string[];
}

const withOnHireCount = {
  _count: { select: { orders: { where: { status: "ON_HIRE" as const } } } },
  aliases: { select: { alias: true }, orderBy: { alias: "asc" as const } },
};

type SiteRow = {
  id: string;
  code: string;
  name: string;
  deliveryAddress: string | null;
  _count: { orders: number };
  aliases: { alias: string }[];
};

function toDto(site: SiteRow): SiteDto {
  return {
    id: site.id,
    code: site.code,
    name: site.name,
    deliveryAddress: site.deliveryAddress,
    ordersOnHire: site._count.orders,
    aliases: site.aliases.map((a) => a.alias),
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

/**
 * PUT /api/sites/:id/aliases: replaces the customer references recorded for the site. They are
 * stored normalised, and an alias can belong to one site only. Invoices not tied to an order
 * are recognised again.
 */
export async function setSiteAliases(id: string, body: unknown): Promise<SiteDto> {
  const { aliases } = siteAliasesSchema.parse(body);
  await getSite(id);
  const normalised = [...new Set(aliases.map(normaliseReference).filter(Boolean))];
  const taken = await db.siteAlias.findMany({
    where: { alias: { in: normalised }, siteId: { not: id } },
    include: { site: { select: { code: true } } },
  });
  if (taken.length > 0) {
    throw new ConflictError(
      `Alias ${taken[0].alias} is already used by site ${taken[0].site.code}`,
      "DUPLICATE_ALIAS",
    );
  }
  await db.$transaction([
    db.siteAlias.deleteMany({ where: { siteId: id } }),
    db.siteAlias.createMany({ data: normalised.map((alias) => ({ siteId: id, alias })) }),
  ]);
  await refreshRecognisedSites();
  return getSite(id);
}

/** GET /api/sites/recognize?customerRef=&deliveryAddress= */
export async function recognizeSiteFor(query: unknown) {
  const printed = recognizeSiteQuerySchema.parse(query);
  const sites = await db.site.findMany({ include: { aliases: true } });
  const result = recognizeSite(
    printed,
    sites.map((site) => ({ ...site, aliases: site.aliases.map((a) => a.alias) })),
  );
  const brief = (siteId: string) => {
    const site = sites.find((s) => s.id === siteId);
    return site ? { id: site.id, code: site.code, name: site.name } : null;
  };
  return {
    site: result.siteId ? brief(result.siteId) : null,
    matchedBy: result.matchedBy,
    candidates: result.candidates.map(brief),
  };
}
