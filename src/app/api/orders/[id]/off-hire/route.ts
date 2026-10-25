import { readJson, route } from "@/server/http";
import { offHireOrder } from "@/server/services/orders";

/** POST /api/orders/:id/off-hire { offHireDate, collectionNo? } */
export const POST = route(
  async (request: Request, ctx: RouteContext<"/api/orders/[id]/off-hire">) => {
    const { id } = await ctx.params;
    return Response.json(await offHireOrder(id, await readJson(request)));
  },
);
