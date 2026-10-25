import { readJson, route } from "@/server/http";
import { createOrder, listOrders } from "@/server/services/orders";

/** GET /api/orders?siteId=...&status=ON_HIRE */
export const GET = route(async (request: Request) => {
  const filters = Object.fromEntries(new URL(request.url).searchParams);
  return Response.json(await listOrders(filters));
});

/** POST /api/orders -> 201 */
export const POST = route(async (request: Request) =>
  Response.json(await createOrder(await readJson(request)), { status: 201 }),
);
