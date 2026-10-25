import { db } from "@/server/db";
import { fromPence } from "@/lib/money";
import { groupInvoicesByDueDate } from "@/lib/payments/due";
import { asOfQuerySchema, today } from "@/lib/schemas/as-of";

/** GET /api/payments/due: unpaid invoices grouped by due date, as of a date (default today). */
export async function getDuePayments(query: unknown = {}) {
  const { asOf = today() } = asOfQuerySchema.parse(query);
  const invoices = await db.invoice.findMany({
    where: { paymentStatus: { in: ["UNPAID", "QUERIED"] }, isCreditNote: false },
    include: {
      supplier: { select: { name: true } },
      lines: {
        orderBy: { position: "asc" },
        select: { order: { select: { site: { select: { code: true } } } } },
      },
    },
  });

  const grouped = groupInvoicesByDueDate(
    invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      supplierName: invoice.supplier.name,
      siteCodes: [
        ...new Set(
          invoice.lines.map((line) => line.order?.site.code).filter((code) => code !== undefined),
        ),
      ],
      dueDate: invoice.dueDate,
      gross: fromPence(invoice.grossPence),
      paymentStatus: invoice.paymentStatus,
      isCreditNote: invoice.isCreditNote,
    })),
    asOf,
  );
  return { asOf, ...grouped };
}

export type DuePayments = Awaited<ReturnType<typeof getDuePayments>>;
