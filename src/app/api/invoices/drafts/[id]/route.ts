import { route } from "@/server/http";
import { discardInvoiceDraft, getInvoiceDraft } from "@/server/services/invoice-import";

/** GET /api/invoices/drafts/:id: what was read, the warnings and the fields still to fill in. */
export const GET = route(
  async (_request: Request, ctx: RouteContext<"/api/invoices/drafts/[id]">) => {
    const { id } = await ctx.params;
    return Response.json(await getInvoiceDraft(id));
  },
);

/** DELETE /api/invoices/drafts/:id -> 204: not an invoice to keep. */
export const DELETE = route(
  async (_request: Request, ctx: RouteContext<"/api/invoices/drafts/[id]">) => {
    const { id } = await ctx.params;
    await discardInvoiceDraft(id);
    return new Response(null, { status: 204 });
  },
);
