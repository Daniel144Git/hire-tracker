import { route } from "@/server/http";
import { getStatement } from "@/server/services/statements";

/** GET /api/statements/:id: the statement's lines and the R11 comparison, worked out now. */
export const GET = route(async (_request: Request, ctx: RouteContext<"/api/statements/[id]">) => {
  const { id } = await ctx.params;
  return Response.json(await getStatement(id));
});
