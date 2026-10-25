import { readJson, route } from "@/server/http";
import { createServiceEvent, listServiceEvents } from "@/server/services/service-events";

/** GET /api/sites/:id/service-events: services, inspections, repairs, damage and losses. */
export const GET = route(
  async (_request: Request, ctx: RouteContext<"/api/sites/[id]/service-events">) => {
    const { id } = await ctx.params;
    return Response.json(await listServiceEvents(id));
  },
);

/** POST /api/sites/:id/service-events -> 201, then the site's invoices are re-checked (R9). */
export const POST = route(
  async (request: Request, ctx: RouteContext<"/api/sites/[id]/service-events">) => {
    const { id } = await ctx.params;
    return Response.json(await createServiceEvent(id, await readJson(request)), { status: 201 });
  },
);
