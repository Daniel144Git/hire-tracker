import { readJson, route } from "@/server/http";
import { setSiteAliases } from "@/server/services/sites";

/** PUT /api/sites/:id/aliases { aliases: string[] }: replaces the site's customer references. */
export const PUT = route(async (request: Request, ctx: RouteContext<"/api/sites/[id]/aliases">) => {
  const { id } = await ctx.params;
  return Response.json(await setSiteAliases(id, await readJson(request)));
});
