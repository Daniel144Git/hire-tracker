import { route } from "@/server/http";
import { exportMonthlyCosts, fileResponse } from "@/server/services/costs";

/** GET /api/reports/costs/export?month=YYYY-MM&format=csv|xlsx|zip: the month as a file. */
export const GET = route(async (request: Request) => {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return fileResponse(await exportMonthlyCosts(query));
});
