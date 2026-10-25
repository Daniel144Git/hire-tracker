import { readJson, route } from "@/server/http";
import { getInvoice, updateInvoiceStatus } from "@/server/services/invoices";

/** GET /api/invoices/:id, with its lines and what each line is linked to. */
export const GET = route(async (_request: Request, ctx: RouteContext<"/api/invoices/[id]">) => {
  const { id } = await ctx.params;
  return Response.json(await getInvoice(id));
});

/** PATCH /api/invoices/:id { paymentStatus?, checkStatus? } */
export const PATCH = route(async (request: Request, ctx: RouteContext<"/api/invoices/[id]">) => {
  const { id } = await ctx.params;
  return Response.json(await updateInvoiceStatus(id, await readJson(request)));
});
