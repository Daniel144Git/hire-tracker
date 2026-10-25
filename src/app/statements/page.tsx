import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { listStatements } from "@/server/services/statements";
import { formatPounds } from "@/app/invoices/format";
import { ImportStatementForm } from "./import-form";

export const metadata: Metadata = { title: "Statements" };

export default function StatementsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Statements</h1>
        <p>
          A supplier statement lists the invoices the supplier considers open. Import it to check it
          against the invoices in Hire Tracker (R11).
        </p>
      </div>
      <section aria-labelledby="import-heading" className="flex flex-col gap-3">
        <h2 id="import-heading" className="text-lg font-medium">
          Import a statement
        </h2>
        <ImportStatementForm />
      </section>
      <Suspense fallback={<p>Loading statements…</p>}>
        <StatementsTable />
      </Suspense>
    </main>
  );
}

async function StatementsTable() {
  await connection();
  const statements = await listStatements();
  if (statements.length === 0) return <p>No statements imported yet.</p>;
  return (
    <table className="w-full border-collapse text-left [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
      <caption className="sr-only">Statements</caption>
      <thead>
        <tr className="border-b border-gray-400">
          <th scope="col">Date</th>
          <th scope="col">Supplier</th>
          <th scope="col" className="text-right">
            Total
          </th>
          <th scope="col">Lines</th>
          <th scope="col">In Hire Tracker</th>
          <th scope="col">Problems</th>
        </tr>
      </thead>
      <tbody>
        {statements.map((statement) => (
          <tr key={statement.id} className="border-b border-gray-200">
            <th scope="row" className="py-2 font-medium">
              <Link href={`/statements/${statement.id}`} className="underline">
                {statement.date}
              </Link>
            </th>
            <td>{statement.supplier.name}</td>
            <td className="text-right whitespace-nowrap">
              {statement.total === null ? "-" : formatPounds(statement.total)}
            </td>
            <td>{statement.summary.lineCount}</td>
            <td>{statement.summary.matched}</td>
            <td>
              {statement.summary.problemCount}
              {statement.summary.highCount > 0 && (
                <span className="font-semibold text-red-700 dark:text-red-400">
                  {" "}
                  ({statement.summary.highCount} high)
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
