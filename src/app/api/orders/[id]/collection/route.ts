import { readJson, route } from "@/server/http";
import { recordCollection } from "@/server/services/orders";

/** POST /api/orders/:id/collection { collectionNo } */
export const POST = route(
  async (request: Request, ctx: RouteContext<"/api/orders/[id]/collection">) => {
    const { id } = await ctx.params;
    return Response.json(await recordCollection(id, await readJson(request)));
  },
);
