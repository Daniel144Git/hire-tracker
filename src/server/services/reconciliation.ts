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
    jobNo: invoice.jobNo,
    orderRef: invoice.orderRef,
    lastInvoiceNo: invoice.lastInvoiceNo,
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
      linkProblem: line.linkProblem,
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
  const { supplier } = invoice;

  const ownOrderIds = linkedOrderIds([invoice]);
  // Related invoices: the same orders (credits, double billing) or the same job (the chain).
  const otherInvoices = await db.invoice.findMany({
    where: {
      supplierId: supplier.id,
      id: { not: invoice.id },
      OR: [
        { lines: { some: { orderId: { in: ownOrderIds } } } },
        ...(invoice.jobNo ? [{ jobNo: invoice.jobNo }] : []),
      ],
    },
    include: invoiceForChecks,
  });

  const orders = await db.hireOrder.findMany({
    where: {
      supplierId: supplier.id,
      OR: [
        { id: { in: linkedOrderIds([invoice, ...otherInvoices]) } },
        ...(invoice.jobNo ? [{ supplierJobNo: invoice.jobNo }] : []),
      ],
    },
    include: {
      items: { include: { codeChanges: { select: { oldCode: true } } } },
      site: { select: { id: true, code: true } },
    },
  });
  const [supplierItems, suspensions] = await Promise.all([
    db.hireItem.findMany({
      where: { order: { supplierId: supplier.id } },
      select: {
        orderId: true,
        description: true,
        weeklyRatePence: true,
        order: { select: { supplierJobNo: true } },
      },
    }),
    db.suspension.findMany({
      where: { siteId: { in: [...new Set(orders.map((order) => order.siteId))] } },
      include: { site: { select: { code: true } } },
    }),
  ]);

  const checkOrders: CheckOrder[] = orders.map((order) => ({
    id: order.id,
    supplierJobNo: order.supplierJobNo,
    site: order.site,
    startDate: order.startDate,
    offHireDate: order.offHireDate,
    damageWaiverApplies: order.damageWaiverApplies,
    items: order.items.map((item) => ({
      id: item.id,
      description: item.description,
      fleetCode: item.fleetCode,
      weeklyRate: fromPence(item.weeklyRatePence),
      previousFleetCodes: item.codeChanges.map((change) => change.oldCode),
    })),
  }));

  return {
    invoice: toCheckInvoice(invoice),
    orders: Object.fromEntries(checkOrders.map((order) => [order.id, order])),
    otherInvoices: otherInvoices.map(toCheckInvoice),
    supplierItems: supplierItems.map((item) => ({
      orderId: item.orderId,
      supplierJobNo: item.order.supplierJobNo,
      description: item.description,
      weeklyRate: fromPence(item.weeklyRatePence),
    })),
    suspensions: suspensions.map((suspension) => ({
      siteId: suspension.siteId,
      siteCode: suspension.site.code,
      periodFrom: suspension.periodFrom,
      periodTo: suspension.periodTo,
      freeDays: suspension.freeDays,
    })),
    rules: chargingRulesOf(supplier),
    tolerance: DEFAULT_TOLERANCE,
    vatRate: STANDARD_VAT_RATE,
  };
}

function linkedOrderIds(invoices: InvoiceRow[]): string[] {
  return [
    ...new Set(
      invoices
        .flatMap((invoice) => invoice.lines.map((line) => line.orderId))
        .filter((id) => id !== null),
    ),
  ];
}

export function chargingRulesOf(supplier: {
  chargeBankHolidays: boolean;
  minChargeDays: number;
  damageWaiverPct: number;
}) {
  return {
    chargeBankHolidays: supplier.chargeBankHolidays,
    bankHolidays: ENGLAND_AND_WALES_BANK_HOLIDAYS,
    minChargeDays: supplier.minChargeDays,
    damageWaiverPct: supplier.damageWaiverPct,
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
 * Re-checks the invoices related to a change: those with lines on these orders (an off-hire
 * date, a credit note, a suspension) and those of the same job number (the invoice chain).
 */
export async function recheckRelatedInvoices(related: {
  orderIds: string[];
  jobNo?: string | null;
  supplierId?: string;
  exceptInvoiceId?: string;
}): Promise<void> {
  const invoices = await db.invoice.findMany({
    where: {
      id: { not: related.exceptInvoiceId },
      OR: [
        { lines: { some: { orderId: { in: related.orderIds } } } },
        ...(related.jobNo && related.supplierId
          ? [{ jobNo: related.jobNo, supplierId: related.supplierId }]
          : []),
      ],
    },
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
