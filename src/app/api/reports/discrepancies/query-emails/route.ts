import { route } from "@/server/http";
import { getQueryEmails } from "@/server/services/reports";

/** GET /api/reports/discrepancies/query-emails?month=YYYY-MM: one draft per supplier. */
export const GET = route(async (request: Request) => {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return Response.json(await getQueryEmails(query));
});
