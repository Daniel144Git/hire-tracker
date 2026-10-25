import { route } from "@/server/http";
import { getHireAlerts } from "@/server/services/alerts";

/** GET /api/alerts?asOf=&longHireDays=&costLimit=&collectionDays= */
export const GET = route(async (request: Request) => {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return Response.json(await getHireAlerts(query));
});
