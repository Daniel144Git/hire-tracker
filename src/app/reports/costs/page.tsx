import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { costsQuerySchema, getMonthlyCosts } from "@/server/services/costs";
import { buttonClass } from "@/app/ui/field";
import { formatPounds } from "@/app/invoices/format";
import type { MonthlyAllocation, TradeKey } from "@/lib/reports/allocation";
import { FilterSelect, pickParams, queryString } from "@/app/ui/filters";
import { listSites } from "@/server/services/sites";
import { listSuppliers } from "@/server/services/suppliers";

export const metadata: Metadata = { title: "Monthly costs" };

const TRADE_LABEL: Record<TradeKey, string> = {
  MECH: "MECH",
  ELEC: "ELEC",
  VENT: "VENT",
  DUCT: "DUCT",
  BMS: "BMS",
  UNASSIGNED: "No trade",
};

const linkClass = "text-link underline";

export default function CostsPage({ searchParams }: PageProps<"/reports/costs">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Monthly costs by site and trade</h1>
        <Link href="/reports/yearly" className={linkClass}>
          Yearly totals
        </Link>
      </div>
      <Suspense fallback={<p>Loading report…</p>}>
        <Report searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Report({
  searchParams,
}: {
  searchParams: PageProps<"/reports/costs">["searchParams"];
}) {
  await connection();
  const params = await searchParams;
  const requested =
    typeof params.month === "string" ? params.month : new Date().toISOString().slice(0, 7);
  const filters = pickParams(params, ["supplierId", "siteId"]);
  const valid = costsQuerySchema.safeParse({ month: requested, ...filters });
  const [suppliers, sites] = await Promise.all([listSuppliers(), listSites()]);

  return (
    <>
      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Choose a month">
        <div className="flex flex-col gap-1">
          <label htmlFor="costs-month" className="text-sm font-medium">
            Month
          </label>
          <input
            id="costs-month"
            name="month"
            type="month"
            defaultValue={requested}
            className="rounded border border-line-strong bg-background px-2 py-1"
          />
        </div>
        <FilterSelect
          id="costs-supplier"
          name="supplierId"
          label="Supplier"
          allLabel="All suppliers"
          value={filters.supplierId}
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
        />
        <FilterSelect
          id="costs-site"
          name="siteId"
          label="Site"
          allLabel="All sites"
          value={filters.siteId}
          options={sites.map((s) => ({ value: s.id, label: `${s.code} - ${s.name}` }))}
        />
        <button type="submit" className={buttonClass}>
          Show
        </button>
      </form>
      {valid.success ? (
        <Costs report={await getMonthlyCosts(valid.data)} filters={filters} />
      ) : (
        <p role="alert" className="text-red-700 dark:text-red-400">
          Choose a month as YYYY-MM.
        </p>
      )}
    </>
  );
}

function Costs({
  report,
  filters,
}: {
  report: MonthlyAllocation;
  filters: Record<string, string>;
}) {
  const { month } = report;
  // The downloads carry the same filters as the page.
  const exportUrl = (format: string) =>
    `/api/reports/costs/export${queryString({ month, ...filters, format })}`;
  if (report.invoiceCount === 0) return <p>No invoices dated in {month}.</p>;

  return (
    <>
      <p data-testid="costs-summary">
        {report.invoiceCount} {report.invoiceCount === 1 ? "invoice" : "invoices"}: net{" "}
        {formatPounds(report.totals.total.net)}, gross {formatPounds(report.totals.total.gross)}.
      </p>
      <p className="flex flex-wrap gap-4">
        {/* API routes, not pages: plain links download the files. */}
        <a href={exportUrl("csv")} className={linkClass}>
          Download the lines (CSV)
        </a>
        <a href={exportUrl("xlsx")} className={linkClass}>
          Download as Excel
        </a>
        <a href={exportUrl("zip")} className={linkClass}>
          Download the invoices by site (ZIP)
        </a>
      </p>
      <table className="w-full border-collapse text-left [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
        <caption className="text-left text-sm">Net cost by site and trade, {month}</caption>
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col">Site</th>
            {report.trades.map((trade) => (
              <th key={trade} scope="col" className="text-right">
                {TRADE_LABEL[trade]}
              </th>
            ))}
            <th scope="col" className="text-right">
              Net
            </th>
            <th scope="col" className="text-right">
              Gross
            </th>
          </tr>
        </thead>
        <tbody>
          {report.sites.map((row) => (
            <tr key={row.site?.id ?? "none"} className="border-b border-line">
              <th scope="row" className="py-2 font-medium">
                {row.site ? `${row.site.code} - ${row.site.name}` : "No site"}
              </th>
              {report.trades.map((trade) => (
                <td key={trade} className="text-right whitespace-nowrap">
                  {row.cells[trade] ? formatPounds(row.cells[trade].net) : "-"}
                </td>
              ))}
              <td className="text-right whitespace-nowrap">{formatPounds(row.total.net)}</td>
              <td className="text-right whitespace-nowrap">{formatPounds(row.total.gross)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-medium">
            <th scope="row" className="py-2">
              Total
            </th>
            {report.trades.map((trade) => (
              <td key={trade} className="text-right whitespace-nowrap">
                {formatPounds(report.totals.byTrade[trade]?.net ?? 0)}
              </td>
            ))}
            <td className="text-right whitespace-nowrap">
              {formatPounds(report.totals.total.net)}
            </td>
            <td className="text-right whitespace-nowrap">
              {formatPounds(report.totals.total.gross)}
            </td>
          </tr>
        </tfoot>
      </table>

      <section aria-labelledby="lines-heading" className="flex flex-col gap-3">
        <h2 id="lines-heading" className="text-lg font-medium">
          The lines behind each site
        </h2>
        {report.sites.map((row) => {
          const name = row.site ? `${row.site.code} - ${row.site.name}` : "No site";
          return (
            <details key={row.site?.id ?? "none"} className="rounded border border-line p-2">
              <summary className="cursor-pointer font-medium">
                {name}: {row.lines.length} {row.lines.length === 1 ? "line" : "lines"}
              </summary>
              <table className="mt-2 w-full border-collapse text-left text-sm [&_td]:px-2 [&_td]:py-1 [&_th]:px-2">
                <caption className="sr-only">Lines of {name}</caption>
                <thead>
                  <tr className="border-b border-line-strong">
                    <th scope="col">Invoice</th>
                    <th scope="col">Trade</th>
                    <th scope="col">Description</th>
                    <th scope="col" className="text-right">
                      Net
                    </th>
                    <th scope="col" className="text-right">
                      VAT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {row.lines.map((line, index) => (
                    <tr key={`${line.invoiceId}-${index}`} className="border-b border-line">
                      <th scope="row" className="font-normal">
                        <Link href={`/invoices/${line.invoiceId}`} className="underline">
                          {line.invoiceNumber}
                        </Link>
                      </th>
                      <td>{TRADE_LABEL[line.trade]}</td>
                      <td>
                        {line.description}
                        {line.fleetCode && ` (${line.fleetCode})`}
                      </td>
                      <td className="text-right whitespace-nowrap">{formatPounds(line.net)}</td>
                      <td className="text-right whitespace-nowrap">{formatPounds(line.vat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          );
        })}
      </section>
    </>
  );
}
