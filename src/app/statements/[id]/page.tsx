import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { NotFoundError } from "@/server/errors";
import { getStatement, type StatementDto } from "@/server/services/statements";
import { formatPounds, SEVERITY_LABEL } from "@/app/invoices/format";
import { MarkPaidForm } from "./mark-paid-form";

export const metadata: Metadata = { title: "Statement" };

const KIND_LABEL: Record<StatementDto["problems"][number]["kind"], string> = {
  MISSING_INVOICE: "Not in Hire Tracker",
  AMOUNT_DIFFERS: "Amount differs",
  PAID_BUT_LISTED: "Paid, still listed",
  NOT_ON_STATEMENT: "Not on the statement",
};

export default function StatementPage({ params }: PageProps<"/statements/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <Suspense fallback={<p>Loading statement…</p>}>
        <StatementDetails params={params} />
      </Suspense>
    </main>
  );
}

async function StatementDetails({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const statement = await findStatement(id);
  const { summary } = statement;
  const amount = (value: number | null) => (value === null ? "-" : formatPounds(value));
  const unlisted = statement.problems.filter((p) => p.kind === "NOT_ON_STATEMENT").length;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          Statement of {statement.date} from {statement.supplier.name}
        </h1>
        {statement.hasFile && (
          <p>
            {/* An API route, not a page: a plain link opens the PDF in the browser. */}
            <a href={`/api/statements/${statement.id}/file`} className="text-link underline">
              Open the statement PDF
            </a>
          </p>
        )}
        <p data-testid="statement-summary">
          {summary.lineCount} {summary.lineCount === 1 ? "line" : "lines"}, {summary.matched} in
          Hire Tracker.{" "}
          {summary.problemCount === 0
            ? "The statement matches our invoices."
            : `${summary.problemCount} ${summary.problemCount === 1 ? "problem" : "problems"}, ${summary.highCount} high.`}
          {statement.total !== null && ` Total ${formatPounds(statement.total)}.`}
        </p>
        {/* Always shown, so its confirmation stays once the invoices are marked. */}
        <MarkPaidForm statementId={statement.id} count={unlisted} />
        {!statement.isLatest && (
          <p className="text-sm">
            A later statement from this supplier exists: invoices paid since are not checked here.
          </p>
        )}
      </div>

      {statement.problems.length > 0 && (
        <section aria-labelledby="problems-heading" className="flex flex-col gap-3">
          <h2 id="problems-heading" className="text-lg font-medium">
            Problems
          </h2>
          <table className="w-full border-collapse text-left align-top [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
            <caption className="sr-only">Problems</caption>
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col">Invoice</th>
                <th scope="col">Problem</th>
                <th scope="col">Severity</th>
                <th scope="col">What to do</th>
                <th scope="col" className="text-right">
                  On statement
                </th>
                <th scope="col" className="text-right">
                  In Hire Tracker
                </th>
              </tr>
            </thead>
            <tbody>
              {statement.problems.map((problem) => (
                <tr
                  key={`${problem.kind}-${problem.lineId ?? problem.invoiceId}`}
                  className="border-b border-line align-top"
                >
                  <th scope="row" className="py-2 font-medium">
                    {problem.invoiceId ? (
                      <Link href={`/invoices/${problem.invoiceId}`} className="underline">
                        {problem.invoiceNo}
                      </Link>
                    ) : (
                      problem.invoiceNo
                    )}
                  </th>
                  <td>{KIND_LABEL[problem.kind]}</td>
                  <td>{SEVERITY_LABEL[problem.severity]}</td>
                  <td>{problem.message}</td>
                  <td className="text-right whitespace-nowrap">
                    {amount(problem.statementAmount)}
                  </td>
                  <td className="text-right whitespace-nowrap">{amount(problem.ourAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section aria-labelledby="lines-heading" className="flex flex-col gap-3">
        <h2 id="lines-heading" className="text-lg font-medium">
          Statement lines
        </h2>
        <table className="w-full border-collapse text-left [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
          <caption className="sr-only">Statement lines</caption>
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col">Invoice</th>
              <th scope="col">Date</th>
              <th scope="col">Job no</th>
              <th scope="col">Customer ref</th>
              <th scope="col" className="text-right">
                Amount
              </th>
              <th scope="col">In Hire Tracker</th>
            </tr>
          </thead>
          <tbody>
            {statement.lines.map((line) => (
              <tr key={line.id} className="border-b border-line">
                <th scope="row" className="py-2 font-medium">
                  {line.invoiceNo}
                </th>
                <td className="whitespace-nowrap">{line.invoiceDate}</td>
                <td>{line.jobNo ?? "-"}</td>
                <td>{line.customerRef ?? "-"}</td>
                <td className="text-right whitespace-nowrap">{formatPounds(line.amount)}</td>
                <td>
                  {line.invoice ? (
                    <Link href={`/invoices/${line.invoice.id}`} className="underline">
                      Open invoice {line.invoice.number}
                    </Link>
                  ) : (
                    <span className="text-red-700 dark:text-red-400">Not in Hire Tracker</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

async function findStatement(id: string): Promise<StatementDto> {
  try {
    return await getStatement(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}
