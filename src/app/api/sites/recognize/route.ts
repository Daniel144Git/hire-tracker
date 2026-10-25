import { route } from "@/server/http";
import { recognizeSiteFor } from "@/server/services/sites";

/** GET /api/sites/recognize?customerRef=...&deliveryAddress=... */
export const GET = route(async (request: Request) => {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return Response.json(await recognizeSiteFor(query));
});
