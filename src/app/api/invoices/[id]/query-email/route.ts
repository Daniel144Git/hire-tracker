import { route } from "@/server/http";
import { getInvoiceQueryEmail } from "@/server/services/invoices";

/** GET /api/invoices/:id/query-email -> { email: { subject, body } | null }. Nothing is sent. */
export const GET = route(
  async (_request: Request, ctx: RouteContext<"/api/invoices/[id]/query-email">) => {
    const { id } = await ctx.params;
    return Response.json(await getInvoiceQueryEmail(id));
  },
);
