import { readJson, route } from "@/server/http";
import { createSite, listSites } from "@/server/services/sites";

/** GET /api/sites */
export const GET = route(async () => Response.json(await listSites()));

/** POST /api/sites -> 201 */
export const POST = route(async (request: Request) =>
  Response.json(await createSite(await readJson(request)), { status: 201 }),
);
