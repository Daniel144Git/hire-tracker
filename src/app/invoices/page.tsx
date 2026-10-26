import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { invoiceFilterSchema, listInvoices } from "@/server/services/invoices";
import { listSites } from "@/server/services/sites";
import { listSuppliers } from "@/server/services/suppliers";
import { buttonClass } from "@/app/ui/field";
import { FilterSelect, pickParams } from "@/app/ui/filters";
import { formatPounds, INVOICE_TYPE_LABEL } from "./format";

export const metadata: Metadata = { title: "Invoices" };

export default function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Link href="/invoices/new" className="rounded bg-blue-700 px-3 py-1 font-medium text-white">
          Enter an invoice
        </Link>
      </div>
      <Suspense fallback={<p>Loading invoices…</p>}>
        <InvoicesTable searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const PAYMENT_OPTIONS = [
  { value: "UNPAID", label: "Unpaid" },
  { value: "PAID", label: "Paid" },
  { value: "QUERIED", label: "Queried" },
  { value: "CREDITED", label: "Credited" },
];

async function InvoicesTable({
  searchParams,
}: {
  searchParams: PageProps<"/invoices">["searchParams"];
}) {
  await connection();
  const filters = pickParams(await searchParams, [
    "supplierId",
    "siteId",
    "month",
    "paymentStatus",
    "openFindings",
  ]);
  const parsed = invoiceFilterSchema.safeParse(filters);
  const [suppliers, sites, invoices] = await Promise.all([
    listSuppliers(),
    listSites(),
    parsed.success ? listInvoices(parsed.data) : Promise.resolve([]),
  ]);
  const filtered = Object.keys(filters).length > 0;

  return (
    <>
      <form method="get" aria-label="Filter invoices" className="flex flex-wrap items-end gap-3">
        <FilterSelect
          id="filter-supplier"
          name="supplierId"
          label="Supplier"
          allLabel="All suppliers"
          value={filters.supplierId}
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
        />
        <FilterSelect
          id="filter-site"
          name="siteId"
          label="Site"
          allLabel="All sites"
          value={filters.siteId}
          options={sites.map((s) => ({ value: s.id, label: `${s.code} - ${s.name}` }))}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-month" className="text-sm font-medium">
            Month
          </label>
          <input
            id="filter-month"
            name="month"
            type="month"
            defaultValue={filters.month}
            className="rounded border border-gray-400 bg-background px-2 py-1"
          />
        </div>
        <FilterSelect
          id="filter-payment"
          name="paymentStatus"
          label="Payment"
          allLabel="Any payment"
          value={filters.paymentStatus}
          options={PAYMENT_OPTIONS}
        />
        <div className="flex items-center gap-2 pb-2">
          <input
            id="filter-open-findings"
            name="openFindings"
            type="checkbox"
            value="true"
            defaultChecked={filters.openFindings === "true"}
          />
          <label htmlFor="filter-open-findings">Only with open findings</label>
        </div>
        <button type="submit" className={buttonClass}>
          Filter
        </button>
        {filtered && (
          <Link href="/invoices" className="pb-1 underline">
            Clear filters
          </Link>
        )}
      </form>
      {!parsed.success ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          Check the filters: the month must be YYYY-MM.
        </p>
      ) : invoices.length === 0 ? (
        <p>{filtered ? "No invoices match these filters." : "No invoices yet."}</p>
      ) : (
        <InvoiceList invoices={invoices} />
      )}
    </>
  );
}

function InvoiceList({ invoices }: { invoices: Awaited<ReturnType<typeof listInvoices>> }) {
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
          <th scope="col">Open findings</th>
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
            <td>
              {invoice.openFindingCount}
              {invoice.highFindingCount > 0 && (
                <span className="font-semibold text-red-700 dark:text-red-400">
                  {" "}
                  ({invoice.highFindingCount} high)
                </span>
              )}
            </td>
            <td>{invoice.unlinkedLineCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
