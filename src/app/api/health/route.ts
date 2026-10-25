import { connection } from "next/server";

/**
 * GET /api/health
 * Tells CI, monitoring and the test suite that the server is up.
 * connection() makes it run on every request instead of being prerendered at build time,
 * so a 200 really means "the server answered now".
 */
export async function GET() {
  await connection();
  return Response.json({ status: "ok" });
}
