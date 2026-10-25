import { readJson, route } from "@/server/http";
import { getOrder, updateOrder } from "@/server/services/orders";

/** GET /api/orders/:id */
export const GET = route(async (_request: Request, ctx: RouteContext<"/api/orders/[id]">) => {
  const { id } = await ctx.params;
  return Response.json(await getOrder(id));
});

/** PATCH /api/orders/:id (trade, damageWaiverApplies) */
export const PATCH = route(async (request: Request, ctx: RouteContext<"/api/orders/[id]">) => {
  const { id } = await ctx.params;
  return Response.json(await updateOrder(id, await readJson(request)));
});
