import { route } from "@/server/http";
import { getYearlyTotals } from "@/server/services/costs";

/** GET /api/reports/yearly?year=YYYY: each site's hire cost by month. */
export const GET = route(async (request: Request) => {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return Response.json(await getYearlyTotals(query));
});
