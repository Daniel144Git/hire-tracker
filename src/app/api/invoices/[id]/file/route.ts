import { route } from "@/server/http";
import { getInvoiceFile } from "@/server/services/invoices";

/** GET /api/invoices/:id/file: the invoice's PDF, shown in the browser. 404 when none was kept. */
export const GET = route(
  async (_request: Request, ctx: RouteContext<"/api/invoices/[id]/file">) => {
    const { id } = await ctx.params;
    const { number, bytes } = await getInvoiceFile(id);
    const filename = `${number.replace(/[^A-Z0-9._-]/gi, "_")}.pdf`;
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
);
