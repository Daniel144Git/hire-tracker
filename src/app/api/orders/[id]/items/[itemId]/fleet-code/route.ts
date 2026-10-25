import { readJson, route } from "@/server/http";
import { changeFleetCode } from "@/server/services/orders";

/** POST /api/orders/:id/items/:itemId/fleet-code { newCode, changedOn, note? } */
export const POST = route(
  async (request: Request, ctx: RouteContext<"/api/orders/[id]/items/[itemId]/fleet-code">) => {
    const { id, itemId } = await ctx.params;
    return Response.json(await changeFleetCode(id, itemId, await readJson(request)));
  },
);
