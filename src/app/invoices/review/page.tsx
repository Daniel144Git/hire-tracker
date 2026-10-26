import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { listInvoiceDrafts } from "@/server/services/invoice-import";
import { listSuppliers } from "@/server/services/suppliers";
import { discardDraftAction } from "../actions";

export const metadata: Metadata = { title: "Invoices to check" };

export default function ReviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Invoices to check</h1>
      <p>
        Read from uploaded PDFs, but not saved: something could not be read or did not add up. Check
        each one, fill in what is marked, and save it.
      </p>
      <Suspense fallback={<p>Loading…</p>}>
        <Drafts />
      </Suspense>
    </main>
  );
}

async function Drafts() {
  await connection();
  const [drafts, suppliers] = await Promise.all([listInvoiceDrafts(), listSuppliers()]);
  if (drafts.length === 0) return <p>Nothing to check.</p>;
  const supplierName = (id?: string) =>
    suppliers.find((s) => s.id === id)?.name ?? "Supplier not recognised";

  return (
    <table className="w-full border-collapse text-left align-top [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
      <caption className="sr-only">Invoices to check</caption>
      <thead>
        <tr className="border-b border-gray-400">
          <th scope="col">File</th>
          <th scope="col">Read as</th>
          <th scope="col">What to check</th>
          <th scope="col">Action</th>
        </tr>
      </thead>
      <tbody>
        {drafts.map((draft) => (
          <tr key={draft.id} className="border-b border-gray-200 align-top">
            <th scope="row" className="py-2 font-normal">
              {draft.fileName}
            </th>
            <td>
              {supplierName(draft.values.supplierId)}
              {draft.values.number && `, invoice ${draft.values.number}`}
            </td>
            <td>
              <ul className="list-disc pl-5 text-sm">
                {draft.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </td>
            <td>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/invoices/new?draft=${draft.id}`} className="underline">
                  Check and save
                </Link>
                <form action={discardDraftAction}>
                  <input type="hidden" name="draftId" value={draft.id} />
                  <button type="submit" className="underline">
                    Discard {draft.fileName}
                  </button>
                </form>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
