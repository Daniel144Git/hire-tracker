import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { listInvoices } from "@/server/services/invoices";
import { formatPounds, INVOICE_TYPE_LABEL } from "./format";

export const metadata: Metadata = { title: "Invoices" };

export default function InvoicesPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Link href="/invoices/new" className="rounded bg-blue-700 px-3 py-1 font-medium text-white">
          Enter an invoice
        </Link>
      </div>
      <Suspense fallback={<p>Loading invoices…</p>}>
        <InvoicesTable />
      </Suspense>
    </main>
  );
}

async function InvoicesTable() {
  await connection();
  const invoices = await listInvoices();
  if (invoices.length === 0) return <p>No invoices yet.</p>;

  return (
    <table className="w-full border-collapse text-left [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
      <caption className="sr-only">Invoices</caption>
      <thead>
        <tr className="border-b border-gray-400">
          <th scope="col">Number</th>
          <th scope="col">Supplier</th>
          <th scope="col">Date</th>
          <th scope="col">Due</th>
          <th scope="col">Type</th>
          <th scope="col">Job no</th>
          <th scope="col" className="text-right">
            Gross
          </th>
          <th scope="col">Lines not linked</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((invoice) => (
          <tr key={invoice.id} className="border-b border-gray-200">
            <th scope="row" className="py-2 font-medium">
              <Link href={`/invoices/${invoice.id}`} className="underline">
                {invoice.number}
              </Link>
            </th>
            <td>{invoice.supplier.name}</td>
            <td className="whitespace-nowrap">{invoice.date}</td>
            <td className="whitespace-nowrap">{invoice.dueDate}</td>
            <td>
              {INVOICE_TYPE_LABEL[invoice.type]}
              {invoice.isCreditNote && " (credit note)"}
            </td>
            <td>{invoice.jobNo ?? "-"}</td>
            <td className="text-right whitespace-nowrap">{formatPounds(invoice.gross)}</td>
            <td>{invoice.unlinkedLineCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
