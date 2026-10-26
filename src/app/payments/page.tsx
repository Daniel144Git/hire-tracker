import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDuePayments } from "@/server/services/payments";
import type { DueInvoice } from "@/lib/payments/due";
import { formatPounds } from "@/app/invoices/format";
import { PaymentButtons } from "./payment-buttons";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <h1 className="text-2xl font-semibold">Payments</h1>
      <Suspense fallback={<p>Loading payments…</p>}>
        <DuePayments />
      </Suspense>
    </main>
  );
}

async function DuePayments() {
  await connection();
  const due = await getDuePayments();
  const groups: [string, string, DueInvoice[], number][] = [
    ["overdue", "Overdue", due.overdue, due.totals.overdue],
    ["due-7", "Due in the next 7 days", due.dueIn7Days, due.totals.dueIn7Days],
    ["due-14", "Due in 8 to 14 days", due.dueIn14Days, due.totals.dueIn14Days],
    ["later", "Due later", due.later, due.totals.later],
    ["queried", "Queried: on hold", due.queried, due.totals.queried],
  ];

  return (
    <>
      <p data-testid="payments-summary">
        As of {due.asOf}: {formatPounds(due.totals.outstanding)} to pay, of which{" "}
        {formatPounds(due.totals.overdue)} overdue. {formatPounds(due.totals.queried)} queried.
      </p>

      {groups.map(([id, title, invoices, total]) => (
        <section key={id} aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
          <h2 id={`${id}-heading`} className="text-lg font-medium">
            {title} ({invoices.length}, {formatPounds(total)})
          </h2>
          {invoices.length === 0 ? <p>None.</p> : <DueTable title={title} invoices={invoices} />}
        </section>
      ))}

      <section aria-labelledby="by-site-heading" className="flex flex-col gap-3">
        <h2 id="by-site-heading" className="text-lg font-medium">
          To pay by site
        </h2>
        <table className="w-full max-w-md border-collapse text-left [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
          <caption className="sr-only">To pay by site</caption>
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col">Site</th>
              <th scope="col" className="text-right">
                To pay
              </th>
              <th scope="col" className="text-right">
                Overdue
              </th>
            </tr>
          </thead>
          <tbody>
            {due.bySite.map((site) => (
              <tr key={site.siteCode} className="border-b border-line">
                <th scope="row" className="py-2 font-medium">
                  {site.siteCode}
                </th>
                <td className="text-right">{formatPounds(site.outstanding)}</td>
                <td className="text-right">{formatPounds(site.overdue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function DueTable({ title, invoices }: { title: string; invoices: DueInvoice[] }) {
  return (
    <table className="w-full border-collapse text-left [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
      <caption className="sr-only">{title}</caption>
      <thead>
        <tr className="border-b border-line-strong">
          <th scope="col">Invoice</th>
          <th scope="col">Supplier</th>
          <th scope="col">Site</th>
          <th scope="col">Due</th>
          <th scope="col">When</th>
          <th scope="col" className="text-right">
            Gross
          </th>
          <th scope="col">Action</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((invoice) => (
          <tr key={invoice.id} className="border-b border-line">
            <th scope="row" className="py-2 font-medium">
              <Link href={`/invoices/${invoice.id}`} className="underline">
                {invoice.number}
              </Link>
            </th>
            <td>{invoice.supplierName}</td>
            <td>{invoice.siteCode}</td>
            <td className="whitespace-nowrap">{invoice.dueDate}</td>
            <td className="whitespace-nowrap">
              {invoice.daysOverdue > 0
                ? `${invoice.daysOverdue} days overdue`
                : invoice.daysUntilDue === 0
                  ? "Due today"
                  : `In ${invoice.daysUntilDue} days`}
            </td>
            <td className="text-right whitespace-nowrap">{formatPounds(invoice.gross)}</td>
            <td>
              <PaymentButtons
                invoiceId={invoice.id}
                invoiceNumber={invoice.number}
                status={invoice.paymentStatus}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
