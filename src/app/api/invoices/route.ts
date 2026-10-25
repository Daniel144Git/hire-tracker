import { readJson, route } from "@/server/http";
import { createInvoice, listInvoices } from "@/server/services/invoices";

/** GET /api/invoices?supplierId=...&jobNo=... */
export const GET = route(async (request: Request) => {
  const filters = Object.fromEntries(new URL(request.url).searchParams);
  return Response.json(await listInvoices(filters));
});

/** POST /api/invoices -> 201. 409 when the supplier's invoice number is already recorded. */
export const POST = route(async (request: Request) =>
  Response.json(await createInvoice(await readJson(request)), { status: 201 }),
);
