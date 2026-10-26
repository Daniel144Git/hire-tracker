import { z } from "zod";
import { monthSchema, optionalId } from "@/lib/schemas/filters";
import { db } from "@/server/db";
import { fromPence } from "@/lib/money";
import { findMissingPeriods, monthRange } from "@/lib/reconciliation/missing-periods";
import { draftQueryEmail } from "@/lib/reports/query-email";
import { summarizeFindings } from "@/lib/reconciliation/report";
import { chargingRulesOf } from "./reconciliation";

export const reportQuerySchema = z.strictObject({
  month: monthSchema,
  supplierId: optionalId,
  siteId: optionalId,
});

const SEVERITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

/**
 * The discrepancy report of a month: every finding on the invoices dated in that month, with
 * the totals at stake, plus the orders on hire that month with no invoice at all (R4).
 */
export async function getDiscrepancyReport(query: unknown) {
  const { month, supplierId, siteId } = reportQuerySchema.parse(query);
  const range = monthRange(month);

  const invoices = await db.invoice.findMany({
    where: { date: { gte: range.from, lte: range.to }, supplierId, siteId },
    include: {
      supplier: { select: { id: true, name: true } },
      findings: { include: { invoiceLine: { select: { position: true } } } },
      lines: {
        select: { order: { select: { supplierJobNo: true, site: { select: { code: true } } } } },
      },
    },
  });

  const findings = invoices
    .flatMap((invoice) => {
      const order = invoice.lines.find((line) => line.order)?.order;
      return invoice.findings.map((finding) => ({
        id: finding.id,
        invoice: { id: invoice.id, number: invoice.number, date: invoice.date },
        supplier: invoice.supplier,
        jobNo: invoice.jobNo ?? order?.supplierJobNo ?? null,
        siteCode: order?.site.code ?? null,
        check: finding.check,
        severity: finding.severity,
        linePosition: finding.invoiceLine?.position ?? null,
        message: finding.message,
        billed: finding.billedPence === null ? null : fromPence(finding.billedPence),
        expected: finding.expectedPence === null ? null : fromPence(finding.expectedPence),
        difference: finding.differencePence === null ? null : fromPence(finding.differencePence),
        resolved: finding.resolved,
        resolution: finding.resolution,
      }));
    })
    .sort(
      (a, b) =>
        Number(a.resolved) - Number(b.resolved) ||
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        (a.siteCode ?? "").localeCompare(b.siteCode ?? "") ||
        a.invoice.number.localeCompare(b.invoice.number),
    );

  return {
    month,
    summary: { invoices: invoices.length, ...summarizeFindings(findings) },
    findings,
    missingPeriods: await missingPeriodsFor(month, { supplierId, siteId }),
  };
}

/** R4 for every supplier: orders on hire in the month with no billed hire period in it. */
async function missingPeriodsFor(
  month: string,
  filters: { supplierId?: string; siteId?: string } = {},
) {
  const range = monthRange(month);
  const suppliers = await db.supplier.findMany({
    where: { id: filters.supplierId },
    include: {
      orders: {
        where: {
          siteId: filters.siteId,
          startDate: { lte: range.to },
          OR: [{ offHireDate: null }, { offHireDate: { gte: range.from } }],
        },
        include: {
          site: { select: { code: true } },
          invoiceLines: {
            where: { chargeType: "HIRE", netPence: { gt: 0 }, periodFrom: { not: null } },
            select: { periodFrom: true, periodTo: true },
          },
        },
      },
    },
  });

  return suppliers.flatMap((supplier) =>
    findMissingPeriods(
      month,
      supplier.orders.map((order) => ({
        id: order.id,
        supplierJobNo: order.supplierJobNo,
        siteCode: order.site.code,
        startDate: order.startDate,
        offHireDate: order.offHireDate,
      })),
      supplier.orders.flatMap((order) =>
        order.invoiceLines.map((line) => {
          const [from, to] = [line.periodFrom as string, line.periodTo as string].sort();
          return { orderId: order.id, from, to };
        }),
      ),
      chargingRulesOf(supplier),
    ),
  );
}

export type DiscrepancyReport = Awaited<ReturnType<typeof getDiscrepancyReport>>;

/**
 * GET /api/reports/discrepancies/query-emails?month=YYYY-MM: one query email per supplier
 * about the open findings on the month's invoices.
 */
export async function getQueryEmails(query: unknown) {
  const report = await getDiscrepancyReport(query);
  const suppliers = new Map(report.findings.map((f) => [f.supplier.id, f.supplier]));
  const emails = [];
  for (const supplier of suppliers.values()) {
    const findings = report.findings.filter((f) => f.supplier.id === supplier.id);
    const invoices = [...new Map(findings.map((f) => [f.invoice.id, f.invoice])).values()]
      .sort((a, b) => a.number.localeCompare(b.number))
      .map((invoice) => ({
        ...invoice,
        findings: findings
          .filter((f) => f.invoice.id === invoice.id)
          .sort((a, b) => (a.linePosition ?? 0) - (b.linePosition ?? 0)),
      }));
    const { accountNo } = await db.supplier.findUniqueOrThrow({
      where: { id: supplier.id },
      select: { accountNo: true },
    });
    const email = draftQueryEmail({ name: supplier.name, accountNo }, invoices);
    if (email) emails.push({ supplier, ...email });
  }
  return emails.sort((a, b) => a.supplier.name.localeCompare(b.supplier.name));
}
