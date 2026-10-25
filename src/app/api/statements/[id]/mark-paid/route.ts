import { route } from "@/server/http";
import { markUnlistedAsPaid } from "@/server/services/statements";

/**
 * POST /api/statements/:id/mark-paid: marks paid our unpaid invoices dated before the
 * statement that it does not list. Returns the statement compared again.
 */
export const POST = route(
  async (_request: Request, ctx: RouteContext<"/api/statements/[id]/mark-paid">) => {
    const { id } = await ctx.params;
    return Response.json(await markUnlistedAsPaid(id));
  },
);
