import { readJson, route } from "@/server/http";
import { getSite, updateSite } from "@/server/services/sites";

/** GET /api/sites/:id */
export const GET = route(async (_request: Request, ctx: RouteContext<"/api/sites/[id]">) => {
  const { id } = await ctx.params;
  return Response.json(await getSite(id));
});

/** PATCH /api/sites/:id */
export const PATCH = route(async (request: Request, ctx: RouteContext<"/api/sites/[id]">) => {
  const { id } = await ctx.params;
  return Response.json(await updateSite(id, await readJson(request)));
});
