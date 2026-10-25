import { route } from "@/server/http";
import { getMonthlyCosts } from "@/server/services/costs";

/** GET /api/reports/costs?month=YYYY-MM: the month's hire cost by site and trade, with the lines. */
export const GET = route(async (request: Request) => {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return Response.json(await getMonthlyCosts(query));
});
