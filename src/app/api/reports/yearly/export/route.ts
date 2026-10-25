import { route } from "@/server/http";
import { exportYearlyTotals, fileResponse } from "@/server/services/costs";

/** GET /api/reports/yearly/export?year=YYYY&format=csv|xlsx: the year as a file. */
export const GET = route(async (request: Request) => {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return fileResponse(await exportYearlyTotals(query));
});
