import { readJson, route } from "@/server/http";
import { createSupplier, listSuppliers } from "@/server/services/suppliers";

/** GET /api/suppliers */
export const GET = route(async () => Response.json(await listSuppliers()));

/** POST /api/suppliers -> 201 */
export const POST = route(async (request: Request) =>
  Response.json(await createSupplier(await readJson(request)), { status: 201 }),
);
