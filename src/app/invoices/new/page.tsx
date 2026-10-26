import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { NotFoundError } from "@/server/errors";
import { getInvoiceDraft } from "@/server/services/invoice-import";
import { Suspense } from "react";
import { listSuppliers } from "@/server/services/suppliers";
import { NewInvoice } from "./new-invoice";

export const metadata: Metadata = { title: "Enter an invoice" };

export default function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Enter an invoice</h1>
      <p>
        Read the invoice from its PDF, or type it in exactly as printed, including any mistakes: the
        checks find them later.
      </p>
      <Suspense fallback={<p>Loading…</p>}>
        <InvoiceFormWithSuppliers searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function InvoiceFormWithSuppliers({
  searchParams,
}: {
  searchParams: PageProps<"/invoices/new">["searchParams"];
}) {
  await connection();
  const { draft: draftId } = await searchParams;
  const suppliers = await listSuppliers();
  const draft = typeof draftId === "string" ? await findDraft(draftId) : undefined;
  return (
    <NewInvoice
      suppliers={suppliers.map(({ id, name }) => ({ id, name }))}
      draft={
        draft && {
          uploadId: draft.uploadId,
          fileName: draft.fileName,
          values: draft.values,
          warnings: draft.warnings,
          missing: draft.missing,
        }
      }
    />
  );
}

async function findDraft(id: string) {
  try {
    return await getInvoiceDraft(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}
