import { z } from "zod";
import { db } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { fromPence, toPence } from "@/lib/money";
import { calculateDueDate } from "@/lib/invoices/due-date";
import { linkInvoiceLine } from "@/lib/invoices/link-line";
import { invoiceCreateSchema, type InvoiceLineInput } from "@/lib/schemas/invoice";
import type { Prisma } from "@/generated/prisma/client";
import { checkInvoice, recheckRelatedInvoices, toFindingDto } from "./reconciliation";

export const invoiceFilterSchema = z.strictObject({
  supplierId: z.string().min(1).optional(),
  jobNo: z.string().trim().toUpperCase().min(1).optional(),
});

const summaryInclude = {
  supplier: { select: { id: true, name: true } },
  lines: { select: { linkProblem: true } },
  findings: { where: { resolved: false }, select: { severity: true } },
} satisfies Prisma.InvoiceInclude;

const detailInclude = {
  supplier: { select: { id: true, name: true } },
  lines: {
    orderBy: { position: "asc" },
    include: {
      order: {
        select: {
          id: true,
          supplierJobNo: true,
          site: { select: { id: true, code: true, name: true } },
        },
      },
      hireItem: { select: { id: true, fleetCode: true, description: true } },
    },
  },
  findings: { orderBy: { rank: "asc" } },
} satisfies Prisma.InvoiceInclude;

type InvoiceSummaryRow = Prisma.InvoiceGetPayload<{ include: typeof summaryInclude }>;
type InvoiceDetailRow = Prisma.InvoiceGetPayload<{ include: typeof detailInclude }>;

function headerDto(invoice: InvoiceSummaryRow | InvoiceDetailRow) {
  return {
    id: invoice.id,
    number: invoice.number,
    supplier: invoice.supplier,
    date: invoice.date,
    dueDate: invoice.dueDate,
    type: invoice.type,
    isCreditNote: invoice.isCreditNote,
    jobNo: invoice.jobNo,
    lastInvoiceNo: invoice.lastInvoiceNo,
    customerRef: invoice.customerRef,
    net: fromPence(invoice.netPence),
    vat: fromPence(invoice.vatPence),
    gross: fromPence(invoice.grossPence),
    checkStatus: invoice.checkStatus,
    paymentStatus: invoice.paymentStatus,
  };
}

function summaryDto(invoice: InvoiceSummaryRow) {
  return {
    ...headerDto(invoice),
    lineCount: invoice.lines.length,
    unlinkedLineCount: invoice.lines.filter((line) => line.linkProblem !== null).length,
    /** Findings not yet resolved, e.g. not credited. */
    openFindingCount: invoice.findings.length,
    highFindingCount: invoice.findings.filter((finding) => finding.severity === "HIGH").length,
  };
}

function detailDto(invoice: InvoiceDetailRow) {
  const linePosition = new Map(invoice.lines.map((line) => [line.id, line.position]));
  return {
    ...headerDto(invoice),
    findings: invoice.findings.map((finding) => toFindingDto(finding, linePosition)),
    lines: invoice.lines.map((line) => ({
      id: line.id,
      position: line.position,
      description: line.description,
      fleetCode: line.fleetCode,
      qty: line.qty,
      periodFrom: line.periodFrom,
      periodTo: line.periodTo,
      weeks: line.weeks,
      days: line.days,
      rate: line.ratePence === null ? null : fromPence(line.ratePence),
      chargeType: line.chargeType,
      net: fromPence(line.netPence),
      vat: fromPence(line.vatPence),
      trade: line.trade,
      order: line.order,
      hireItem: line.hireItem,
      linkProblem: line.linkProblem,
    })),
  };
}

export type InvoiceSummaryDto = ReturnType<typeof summaryDto>;
export type InvoiceDto = ReturnType<typeof detailDto>;

export async function listInvoices(filters: unknown = {}): Promise<InvoiceSummaryDto[]> {
  const where = invoiceFilterSchema.parse(filters);
  const invoices = await db.invoice.findMany({
    where,
    include: summaryInclude,
    orderBy: [{ date: "desc" }, { number: "asc" }],
  });
  return invoices.map(summaryDto);
}

export async function getInvoice(id: string): Promise<InvoiceDto> {
  const invoice = await db.invoice.findUnique({ where: { id }, include: detailInclude });
  if (!invoice) throw new NotFoundError("Invoice", id);
  return detailDto(invoice);
}

/**
 * Records an invoice exactly as printed. The due date comes from the supplier's payment terms
 * unless given, and every line is linked to a hire order and item where possible.
 */
export async function createInvoice(body: unknown): Promise<InvoiceDto> {
  const { lines, net, vat, gross, ...input } = invoiceCreateSchema.parse(body);

  const supplier = await db.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier) {
    throw new ValidationError("The request is not valid", [
      { path: ["supplierId"], message: "Supplier not found" },
    ]);
  }

  const duplicate = await db.invoice.findUnique({
    where: { supplierId_number: { supplierId: supplier.id, number: input.number } },
  });
  if (duplicate) {
    throw new ConflictError(
      `Invoice ${input.number} from ${supplier.name} is already recorded`,
      "DUPLICATE_INVOICE",
    );
  }

  const orders = await db.hireOrder.findMany({
    where: { supplierId: supplier.id },
    select: { id: true, supplierJobNo: true, items: { select: { id: true, fleetCode: true } } },
  });

  const invoice = await db.invoice.create({
    select: { id: true },
    data: {
      ...input,
      dueDate: input.dueDate ?? calculateDueDate(input.date, supplier),
      netPence: toPence(net),
      vatPence: toPence(vat),
      grossPence: toPence(gross),
      lines: {
        create: lines.map((line, index) => {
          const link = linkInvoiceLine(line, input.jobNo, orders);
          return {
            ...toLineData(line),
            position: index + 1,
            orderId: link.orderId,
            hireItemId: link.hireItemId,
            linkProblem: link.problem,
          };
        }),
      },
    },
  });

  // Check the new invoice, then the other invoices of the same orders and job: a credit note
  // can close an R1 finding, a late invoice can repair the chain (R14) on a later one.
  await checkInvoice(invoice.id);
  const linkedOrderIds = await db.invoiceLine.findMany({
    where: { invoiceId: invoice.id, orderId: { not: null } },
    select: { orderId: true },
    distinct: ["orderId"],
  });
  await recheckRelatedInvoices({
    orderIds: linkedOrderIds.map((line) => line.orderId).filter((id) => id !== null),
    jobNo: input.jobNo,
    supplierId: supplier.id,
    exceptInvoiceId: invoice.id,
  });
  return getInvoice(invoice.id);
}

/** POST /api/invoices/:id/check: runs the checks again, e.g. after an order was corrected. */
export async function recheckInvoice(id: string) {
  await getInvoice(id);
  return checkInvoice(id);
}

function toLineData({ rate, net, vat, ...line }: InvoiceLineInput) {
  return {
    ...line,
    ratePence: rate === undefined ? undefined : toPence(rate),
    netPence: toPence(net),
    vatPence: toPence(vat),
  };
}
