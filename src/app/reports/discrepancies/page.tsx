import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDiscrepancyReport, getQueryEmails, reportQuerySchema } from "@/server/services/reports";
import { QueryEmail } from "@/app/ui/query-email";
import { FilterSelect, pickParams } from "@/app/ui/filters";
import { listSites } from "@/server/services/sites";
import { listSuppliers } from "@/server/services/suppliers";
import { buttonClass } from "@/app/ui/field";
import { CHECK_LABEL, formatPounds, SEVERITY_LABEL } from "@/app/invoices/format";

export const metadata: Metadata = { title: "Discrepancies" };

export default function DiscrepanciesPage({ searchParams }: PageProps<"/reports/discrepancies">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Discrepancy report</h1>
      <Suspense fallback={<p>Loading report…</p>}>
        <Report searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Report({
  searchParams,
}: {
  searchParams: PageProps<"/reports/discrepancies">["searchParams"];
}) {
  await connection();
  const params = await searchParams;
  // Default: the current month.
  const requested =
    typeof params.month === "string" ? params.month : new Date().toISOString().slice(0, 7);
  const filters = pickParams(params, ["supplierId", "siteId"]);
  const valid = reportQuerySchema.safeParse({ month: requested, ...filters });
  const [suppliers, sites] = await Promise.all([listSuppliers(), listSites()]);

  return (
    <>
      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Choose a month">
        <div className="flex flex-col gap-1">
          <label htmlFor="report-month" className="text-sm font-medium">
            Month
          </label>
          <input
            id="report-month"
            name="month"
            type="month"
            defaultValue={requested}
            className="rounded border border-gray-400 bg-background px-2 py-1"
          />
        </div>
        <FilterSelect
          id="report-supplier"
          name="supplierId"
          label="Supplier"
          allLabel="All suppliers"
          value={filters.supplierId}
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
        />
        <FilterSelect
          id="report-site"
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
        <ReportContent query={valid.data} />
      ) : (
        <p role="alert" className="text-red-700 dark:text-red-400">
          Choose a month as YYYY-MM.
        </p>
      )}
    </>
  );
}

async function ReportContent({
  query,
}: {
  query: { month: string; supplierId?: string; siteId?: string };
}) {
  const { month } = query;
  const [report, emails] = await Promise.all([getDiscrepancyReport(query), getQueryEmails(query)]);
  const { summary } = report;
  const amount = (value: number | null) => (value === null ? "-" : formatPounds(value));

  return (
    <>
      <p data-testid="report-summary">
        {summary.invoices} {summary.invoices === 1 ? "invoice" : "invoices"} dated {month}:{" "}
        {summary.openFindings} open {summary.openFindings === 1 ? "finding" : "findings"}
        {summary.highFindings > 0 && `, ${summary.highFindings} high`}, overcharged{" "}
        {formatPounds(summary.overcharged)}
        {summary.resolvedFindings > 0 && `, ${summary.resolvedFindings} resolved`}.
      </p>

      {emails.length > 0 && (
        <section aria-labelledby="query-emails-heading" className="flex flex-col gap-3">
          <h2 id="query-emails-heading" className="text-lg font-medium">
            Query emails
          </h2>
          {emails.map((email) => (
            <QueryEmail
              key={email.supplier.id}
              title={`Draft a query email to ${email.supplier.name}`}
              subject={email.subject}
              body={email.body}
            />
          ))}
        </section>
      )}

      <section aria-labelledby="report-findings-heading" className="flex flex-col gap-3">
        <h2 id="report-findings-heading" className="text-lg font-medium">
          Findings on the month&apos;s invoices
        </h2>
        {report.findings.length === 0 ? (
          <p>No findings on the invoices of this month.</p>
        ) : (
          <table className="w-full border-collapse text-left align-top [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
            <caption className="sr-only">Findings of the month</caption>
            <thead>
              <tr className="border-b border-gray-400">
                <th scope="col">Invoice</th>
                <th scope="col">Site</th>
                <th scope="col">Job</th>
                <th scope="col">Check</th>
                <th scope="col">Severity</th>
                <th scope="col">Finding</th>
                <th scope="col" className="text-right">
                  Difference
                </th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.findings.map((finding) => (
                <tr key={finding.id} className="border-b border-gray-200 align-top">
                  <th scope="row" className="py-2 font-medium whitespace-nowrap">
                    <Link href={`/invoices/${finding.invoice.id}`} className="underline">
                      {finding.invoice.number}
                    </Link>
                  </th>
                  <td>{finding.siteCode ?? "-"}</td>
                  <td>{finding.jobNo ?? "-"}</td>
                  <td className="whitespace-nowrap">
                    {finding.check} {CHECK_LABEL[finding.check]}
                  </td>
                  <td>{SEVERITY_LABEL[finding.severity]}</td>
                  <td>{finding.message}</td>
                  <td className="text-right whitespace-nowrap">{amount(finding.difference)}</td>
                  <td>{finding.resolved ? (finding.resolution ?? "Resolved") : "Open"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="missing-heading" className="flex flex-col gap-3">
        <h2 id="missing-heading" className="text-lg font-medium">
          On hire with no invoice (R4)
        </h2>
        {report.missingPeriods.length === 0 ? (
          <p>Every order on hire this month has an invoice for it.</p>
        ) : (
          <table className="w-full border-collapse text-left [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
            <caption className="sr-only">Orders on hire with no invoice</caption>
            <thead>
              <tr className="border-b border-gray-400">
                <th scope="col">Job</th>
                <th scope="col">Site</th>
                <th scope="col">On hire</th>
                <th scope="col">Working days</th>
              </tr>
            </thead>
            <tbody>
              {report.missingPeriods.map((gap) => (
                <tr key={gap.orderId} className="border-b border-gray-200">
                  <th scope="row" className="py-2 font-medium">
                    {gap.supplierJobNo}
                  </th>
                  <td>{gap.siteCode}</td>
                  <td className="whitespace-nowrap">
                    {gap.from} to {gap.to}
                  </td>
                  <td>{gap.workingDaysOnHire}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
