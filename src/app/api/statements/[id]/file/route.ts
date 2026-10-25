import { route } from "@/server/http";
import { getStatementFile } from "@/server/services/statements";

/** GET /api/statements/:id/file: the statement's PDF. 404 when it was not imported from one. */
export const GET = route(
  async (_request: Request, ctx: RouteContext<"/api/statements/[id]/file">) => {
    const { id } = await ctx.params;
    const { date, bytes } = await getStatementFile(id);
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="statement-${date}.pdf"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
);
