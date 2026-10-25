import { route } from "@/server/http";
import { recheckInvoice } from "@/server/services/invoices";

/** POST /api/invoices/:id/check: runs the reconciliation checks again and returns the findings. */
export const POST = route(
  async (_request: Request, ctx: RouteContext<"/api/invoices/[id]/check">) => {
    const { id } = await ctx.params;
    return Response.json(await recheckInvoice(id));
  },
);
