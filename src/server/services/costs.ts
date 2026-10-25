import { z } from "zod";
import { db } from "@/server/db";
import { fromPence } from "@/lib/money";
import {
  allocateMonth,
  totalsByMonth,
  type InvoiceForAllocation,
  type MonthlyAllocation,
  type YearlyTotals,
} from "@/lib/reports/allocation";
import { folderName, toCsv, toXlsx, toZip, type Cell } from "@/lib/exports/files";
import { readStoredFile } from "@/server/files/invoice-files";

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be YYYY-MM");
const year = z.coerce.number().int().min(2000, "Year must be 2000 or later").max(9999);

export const costsQuerySchema = z.strictObject({ month });
export const yearlyQuerySchema = z.strictObject({ year });
export const costsExportSchema = z.strictObject({ month, format: z.enum(["csv", "xlsx", "zip"]) });
export const yearlyExportSchema = z.strictObject({ year, format: z.enum(["csv", "xlsx"]) });

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** The invoices dated from `prefix` ("2026-08" or "2026"), shaped for allocation. */
async function invoicesDated(
  prefix: string,
): Promise<(InvoiceForAllocation & { filePath: string | null })[]> {
  const invoices = await db.invoice.findMany({
    where: { date: { startsWith: prefix } },
    orderBy: [{ date: "asc" }, { number: "asc" }],
    include: {
      site: { select: { id: true, code: true, name: true } },
      lines: {
        orderBy: { position: "asc" },
        include: { order: { select: { trade: true } } },
      },
    },
  });
  return invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    date: invoice.date,
    site: invoice.site,
    vat: fromPence(invoice.vatPence),
    filePath: invoice.filePath,
    lines: invoice.lines.map((line) => ({
      description: line.description,
      fleetCode: line.fleetCode,
      trade: line.trade ?? line.order?.trade ?? null,
      net: fromPence(line.netPence),
      vat: fromPence(line.vatPence),
    })),
  }));
}

/** GET /api/reports/costs?month=YYYY-MM */
export async function getMonthlyCosts(query: unknown): Promise<MonthlyAllocation> {
  const { month } = costsQuerySchema.parse(query);
  return allocateMonth(await invoicesDated(month), month);
}

/** GET /api/reports/yearly?year=YYYY */
export async function getYearlyTotals(query: unknown): Promise<YearlyTotals> {
  const { year } = yearlyQuerySchema.parse(query);
  return totalsByMonth(await invoicesDated(String(year)), year);
}

const siteCode = (site: { code: string } | null) => site?.code ?? "No site";
const siteName = (site: { name: string } | null) => site?.name ?? "";

function summaryRows(report: MonthlyAllocation): Cell[][] {
  const header = ["Site", "Site name", ...report.trades.map(String), "Net", "VAT", "Gross"];
  const rows: Cell[][] = report.sites.map((row) => [
    siteCode(row.site),
    siteName(row.site),
    ...report.trades.map((trade) => row.cells[trade]?.net ?? null),
    row.total.net,
    row.total.vat,
    row.total.gross,
  ]);
  const { byTrade, total } = report.totals;
  return [
    header,
    ...rows,
    [
      "Total",
      "",
      ...report.trades.map((t) => byTrade[t]?.net ?? null),
      total.net,
      total.vat,
      total.gross,
    ],
  ];
}

function lineRows(rows: MonthlyAllocation["sites"]): Cell[][] {
  return [
    [
      "Site",
      "Trade",
      "Invoice",
      "Invoice date",
      "Description",
      "Fleet code",
      "Net",
      "VAT",
      "Gross",
    ],
    ...rows.flatMap((row) =>
      row.lines.map((line) => [
        siteCode(row.site),
        line.trade,
        line.invoiceNumber,
        line.invoiceDate,
        line.description,
        line.fleetCode,
        line.net,
        line.vat,
        line.gross,
      ]),
    ),
  ];
}

export interface ExportFile {
  name: string;
  contentType: string;
  body: Uint8Array<ArrayBuffer> | string;
}

/**
 * The month as a file: CSV of every line, Excel with the site x trade summary and the lines, or
 * a ZIP with one folder per site holding its invoice PDFs and a summary CSV.
 */
export async function exportMonthlyCosts(query: unknown): Promise<ExportFile> {
  const { format, month } = costsExportSchema.parse(query);
  const invoices = await invoicesDated(month);
  const report = allocateMonth(invoices, month);
  const base = `hire-costs-${month}`;
  if (format === "csv") {
    return {
      name: `${base}.csv`,
      contentType: "text/csv; charset=utf-8",
      body: toCsv(lineRows(report.sites)),
    };
  }
  if (format === "xlsx") {
    return {
      name: `${base}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: new Uint8Array(
        toXlsx([
          { name: `Costs ${month}`, rows: summaryRows(report) },
          { name: "Lines", rows: lineRows(report.sites) },
        ]),
      ),
    };
  }
  const files: Record<string, string | Uint8Array> = {
    [`${base}.csv`]: toCsv(summaryRows(report)),
  };
  for (const row of report.sites) {
    const folder = folderName(row.site);
    const siteInvoices = invoices.filter(
      (invoice) => (invoice.site?.id ?? null) === (row.site?.id ?? null),
    );
    const summary: Cell[][] = [["Invoice", "Invoice date", "PDF", "Net", "VAT", "Gross"]];
    for (const invoice of siteInvoices) {
      const lines = row.lines.filter((line) => line.invoiceId === invoice.id);
      const sum = (pick: (l: (typeof lines)[number]) => number) =>
        Math.round(lines.reduce((total, line) => total + pick(line) * 100, 0)) / 100;
      let pdf = "not uploaded";
      if (invoice.filePath) {
        const name = `${invoice.number.replace(/[\\/:*?"<>|]/g, "-")}.pdf`;
        files[`${folder}/${name}`] = await readStoredFile(invoice.filePath, {
          resource: "invoice",
          id: invoice.id,
        });
        pdf = name;
      }
      summary.push([
        invoice.number,
        invoice.date,
        pdf,
        sum((l) => l.net),
        sum((l) => l.vat),
        sum((l) => l.gross),
      ]);
    }
    summary.push(["Total", "", "", row.total.net, row.total.vat, row.total.gross]);
    files[`${folder}/summary.csv`] = toCsv(summary);
  }
  return {
    name: `${base}.zip`,
    contentType: "application/zip",
    body: new Uint8Array(toZip(files)),
  };
}

function yearlyRows(report: YearlyTotals): Cell[][] {
  return [
    ["Site", "Site name", ...MONTH_NAMES, "Net", "VAT", "Gross"],
    ...report.sites.map((row) => [
      siteCode(row.site),
      siteName(row.site),
      ...row.months.map((m) => m.gross),
      row.total.net,
      row.total.vat,
      row.total.gross,
    ]),
    [
      "Total",
      "",
      ...report.monthTotals.map((m) => m.gross),
      report.total.net,
      report.total.vat,
      report.total.gross,
    ],
  ];
}

/** The year as CSV or Excel: gross by site and month, with net, VAT and gross totals. */
export async function exportYearlyTotals(query: unknown): Promise<ExportFile> {
  const { format, year } = yearlyExportSchema.parse(query);
  const report = totalsByMonth(await invoicesDated(String(year)), year);
  const base = `hire-costs-${year}`;
  if (format === "csv") {
    return {
      name: `${base}.csv`,
      contentType: "text/csv; charset=utf-8",
      body: toCsv(yearlyRows(report)),
    };
  }
  return {
    name: `${base}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    body: new Uint8Array(toXlsx([{ name: `Total ${year}`, rows: yearlyRows(report) }])),
  };
}

export function fileResponse(file: ExportFile): Response {
  return new Response(file.body, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.name}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
