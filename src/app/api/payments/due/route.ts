import { route } from "@/server/http";
import { getDuePayments } from "@/server/services/payments";

/** GET /api/payments/due?asOf=YYYY-MM-DD */
export const GET = route(async (request: Request) => {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return Response.json(await getDuePayments(query));
});
