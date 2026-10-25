import { readJson, route } from "@/server/http";
import { addItem } from "@/server/services/orders";

/** POST /api/orders/:id/items -> 201 (e.g. an accessory added later) */
export const POST = route(async (request: Request, ctx: RouteContext<"/api/orders/[id]/items">) => {
  const { id } = await ctx.params;
  return Response.json(await addItem(id, await readJson(request)), { status: 201 });
});
