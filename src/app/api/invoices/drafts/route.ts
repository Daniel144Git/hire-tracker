import { route } from "@/server/http";
import { listInvoiceDrafts } from "@/server/services/invoice-import";

/** GET /api/invoices/drafts: invoices read from PDFs, waiting for a person to check them. */
export const GET = route(async () => Response.json(await listInvoiceDrafts()));
