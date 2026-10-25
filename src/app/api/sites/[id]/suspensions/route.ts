import { readJson, route } from "@/server/http";
import { createSuspension, listSuspensions } from "@/server/services/suspensions";

/** GET /api/sites/:id/suspensions */
export const GET = route(
  async (_request: Request, ctx: RouteContext<"/api/sites/[id]/suspensions">) => {
    const { id } = await ctx.params;
    return Response.json(await listSuspensions(id));
  },
);

/** POST /api/sites/:id/suspensions -> 201, then the site's invoices are re-checked (R16). */
export const POST = route(
  async (request: Request, ctx: RouteContext<"/api/sites/[id]/suspensions">) => {
    const { id } = await ctx.params;
    return Response.json(await createSuspension(id, await readJson(request)), { status: 201 });
  },
);
