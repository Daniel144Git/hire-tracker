import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getYearlyTotals, yearlyQuerySchema } from "@/server/services/costs";
import { buttonClass } from "@/app/ui/field";
import { formatPounds } from "@/app/invoices/format";
import type { YearlyTotals } from "@/lib/reports/allocation";

export const metadata: Metadata = { title: "Yearly totals" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const linkClass = "text-blue-700 underline dark:text-blue-400";

export default function YearlyPage({ searchParams }: PageProps<"/reports/yearly">) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Yearly totals by site</h1>
        <Link href="/reports/costs" className={linkClass}>
          Monthly costs
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
  searchParams: PageProps<"/reports/yearly">["searchParams"];
}) {
  await connection();
  const params = await searchParams;
  const requested =
    typeof params.year === "string" ? params.year : String(new Date().getUTCFullYear());
  const valid = yearlyQuerySchema.safeParse({ year: requested });

  return (
    <>
      <form method="get" className="flex items-end gap-3" aria-label="Choose a year">
        <div className="flex flex-col gap-1">
          <label htmlFor="yearly-year" className="text-sm font-medium">
            Year
          </label>
          <input
            id="yearly-year"
            name="year"
            type="number"
            min={2000}
            max={9999}
            defaultValue={requested}
            className="w-28 rounded border border-gray-400 bg-background px-2 py-1"
          />
        </div>
        <button type="submit" className={buttonClass}>
          Show
        </button>
      </form>
      {valid.success ? (
        <Totals report={await getYearlyTotals({ year: valid.data.year })} />
      ) : (
        <p role="alert" className="text-red-700 dark:text-red-400">
          Choose a year from 2000.
        </p>
      )}
    </>
  );
}

function Totals({ report }: { report: YearlyTotals }) {
  if (report.sites.length === 0) return <p>No invoices dated in {report.year}.</p>;
  const exportUrl = (format: string) =>
    `/api/reports/yearly/export?year=${report.year}&format=${format}`;
  const cell = (value: number) => (value === 0 ? "-" : formatPounds(value));
  return (
    <>
      <p className="flex flex-wrap gap-4">
        <a href={exportUrl("csv")} className={linkClass}>
          Download as CSV
        </a>
        <a href={exportUrl("xlsx")} className={linkClass}>
          Download as Excel
        </a>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
          <caption className="text-left">Gross cost by site and month, {report.year}</caption>
          <thead>
            <tr className="border-b border-gray-400">
              <th scope="col">Site</th>
              {MONTHS.map((month) => (
                <th key={month} scope="col" className="text-right">
                  {month}
                </th>
              ))}
              <th scope="col" className="text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {report.sites.map((row) => (
              <tr key={row.site?.id ?? "none"} className="border-b border-gray-200">
                <th scope="row" className="py-2 font-medium whitespace-nowrap">
                  {row.site ? row.site.code : "No site"}
                </th>
                {row.months.map((month, index) => (
                  <td key={MONTHS[index]} className="text-right whitespace-nowrap">
                    {cell(month.gross)}
                  </td>
                ))}
                <td className="text-right font-medium whitespace-nowrap">
                  {formatPounds(row.total.gross)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-medium">
              <th scope="row" className="py-2">
                Total
              </th>
              {report.monthTotals.map((month, index) => (
                <td key={MONTHS[index]} className="text-right whitespace-nowrap">
                  {cell(month.gross)}
                </td>
              ))}
              <td className="text-right whitespace-nowrap">{formatPounds(report.total.gross)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
