import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { ENGLAND_AND_WALES_BANK_HOLIDAYS } from "@/lib/charging/uk-bank-holidays";
import { fromPence, toPence } from "@/lib/money";
import { DEFAULT_TOLERANCE, STANDARD_VAT_RATE } from "@/lib/reconciliation/config";
import { runChecks } from "@/lib/reconciliation/run-checks";
import type { CheckInvoice, CheckOrder, ReconciliationContext } from "@/lib/reconciliation/types";
import type { Finding as FindingRow, Prisma } from "@/generated/prisma/client";

const invoiceForChecks = {
  lines: { orderBy: { position: "asc" } },
} satisfies Prisma.InvoiceInclude;

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceForChecks }>;

function toCheckInvoice(invoice: InvoiceRow): CheckInvoice {
  return {
    id: invoice.id,
    number: invoice.number,
    date: invoice.date,
    type: invoice.type,
    isCreditNote: invoice.isCreditNote,
    net: fromPence(invoice.netPence),
    vat: fromPence(invoice.vatPence),
    gross: fromPence(invoice.grossPence),
    lines: invoice.lines.map((line) => ({
      id: line.id,
      position: line.position,
      description: line.description,
      fleetCode: line.fleetCode,
      qty: line.qty,
      periodFrom: line.periodFrom,
      periodTo: line.periodTo,
      chargeType: line.chargeType,
      net: fromPence(line.netPence),
      vat: fromPence(line.vatPence),
      orderId: line.orderId,
      hireItemId: line.hireItemId,
    })),
  };
}

/** Loads everything the checks need for one invoice, as plain data. */
async function buildContext(invoiceId: string): Promise<ReconciliationContext> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { ...invoiceForChecks, supplier: true },
  });
  if (!invoice) throw new NotFoundError("Invoice", invoiceId);

  const orderIds = [
    ...new Set(invoice.lines.map((line) => line.orderId).filter((id) => id !== null)),
  ];
  const [orders, otherInvoices] = await Promise.all([
    db.hireOrder.findMany({ where: { id: { in: orderIds } }, include: { items: true } }),
    db.invoice.findMany({
      where: {
        supplierId: invoice.supplierId,
        id: { not: invoice.id },
        lines: { some: { orderId: { in: orderIds } } },
      },
      include: invoiceForChecks,
    }),
  ]);

  const checkOrders: CheckOrder[] = orders.map((order) => ({
    id: order.id,
    supplierJobNo: order.supplierJobNo,
    startDate: order.startDate,
    offHireDate: order.offHireDate,
    damageWaiverApplies: order.damageWaiverApplies,
    items: order.items.map((item) => ({
      id: item.id,
      fleetCode: item.fleetCode,
      weeklyRate: fromPence(item.weeklyRatePence),
    })),
  }));

  const { supplier } = invoice;
  return {
    invoice: toCheckInvoice(invoice),
    orders: Object.fromEntries(checkOrders.map((order) => [order.id, order])),
    otherInvoices: otherInvoices.map(toCheckInvoice),
    rules: {
      chargeBankHolidays: supplier.chargeBankHolidays,
      bankHolidays: ENGLAND_AND_WALES_BANK_HOLIDAYS,
      minChargeDays: supplier.minChargeDays,
      damageWaiverPct: supplier.damageWaiverPct,
    },
    tolerance: DEFAULT_TOLERANCE,
    vatRate: STANDARD_VAT_RATE,
  };
}

const optionalPence = (value: number | null) => (value === null ? null : toPence(value));

/**
 * Runs every check on one invoice and replaces its findings with the new ones.
 * The invoice becomes CHECKED (a QUERIED invoice stays QUERIED: that is the user's decision).
 */
export async function checkInvoice(invoiceId: string): Promise<FindingDto[]> {
  const context = await buildContext(invoiceId);
  const findings = runChecks(context);
  const position = new Map(context.invoice.lines.map((line) => [line.id, line.position]));

  await db.$transaction([
    db.finding.deleteMany({ where: { invoiceId } }),
    db.finding.createMany({
      data: findings.map((finding, rank) => ({
        invoiceId,
        invoiceLineId: finding.invoiceLineId,
        check: finding.check,
        severity: finding.severity,
        message: finding.message,
        billedPence: optionalPence(finding.billed),
        expectedPence: optionalPence(finding.expected),
        differencePence: optionalPence(finding.difference),
        resolved: finding.resolved,
        resolution: finding.resolution,
        rank,
      })),
    }),
    db.invoice.updateMany({
      where: { id: invoiceId, checkStatus: "NOT_CHECKED" },
      data: { checkStatus: "CHECKED" },
    }),
  ]);

  const rows = await db.finding.findMany({ where: { invoiceId }, orderBy: { rank: "asc" } });
  return rows.map((row) => toFindingDto(row, position));
}

/**
 * Re-checks every invoice with lines on these orders, e.g. after an off-hire date is entered
 * (R1 depends on it) or after a credit note arrives (it can close an R1 finding).
 */
export async function recheckInvoicesForOrders(
  orderIds: string[],
  exceptInvoiceId?: string,
): Promise<void> {
  const invoices = await db.invoice.findMany({
    where: { id: { not: exceptInvoiceId }, lines: { some: { orderId: { in: orderIds } } } },
    select: { id: true },
  });
  for (const invoice of invoices) {
    await checkInvoice(invoice.id);
  }
}

export function toFindingDto(row: FindingRow, linePosition: Map<string, number>) {
  return {
    id: row.id,
    check: row.check,
    severity: row.severity,
    invoiceLineId: row.invoiceLineId,
    linePosition: row.invoiceLineId ? (linePosition.get(row.invoiceLineId) ?? null) : null,
    message: row.message,
    billed: row.billedPence === null ? null : fromPence(row.billedPence),
    expected: row.expectedPence === null ? null : fromPence(row.expectedPence),
    difference: row.differencePence === null ? null : fromPence(row.differencePence),
    resolved: row.resolved,
    resolution: row.resolution,
  };
}

export type FindingDto = ReturnType<typeof toFindingDto>;
