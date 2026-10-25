import { route } from "@/server/http";
import { getOnHireRegister } from "@/server/services/register";

/** GET /api/sites/:id/on-hire?asOf=YYYY-MM-DD */
export const GET = route(async (request: Request, ctx: RouteContext<"/api/sites/[id]/on-hire">) => {
  const { id } = await ctx.params;
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return Response.json(await getOnHireRegister(id, query));
});
