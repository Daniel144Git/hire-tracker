import { readJson, route } from "@/server/http";
import { createStatement, listStatements } from "@/server/services/statements";

/** GET /api/statements: every statement, with how many lines match and how many problems. */
export const GET = route(async () => Response.json(await listStatements()));

/** POST /api/statements -> 201, with the R11 comparison. 409 when that date is imported. */
export const POST = route(async (request: Request) =>
  Response.json(await createStatement(await readJson(request)), { status: 201 }),
);
