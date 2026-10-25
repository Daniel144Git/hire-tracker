import { route } from "@/server/http";
import { getDiscrepancyReport } from "@/server/services/reports";

/** GET /api/reports/discrepancies?month=2026-08 */
export const GET = route(async (request: Request) => {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return Response.json(await getDiscrepancyReport(query));
});
