import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { listSuppliers } from "@/server/services/suppliers";
import { NewInvoice } from "./new-invoice";

export const metadata: Metadata = { title: "Enter an invoice" };

export default function NewInvoicePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Enter an invoice</h1>
      <p>
        Read the invoice from its PDF, or type it in exactly as printed, including any mistakes: the
        checks find them later.
      </p>
      <Suspense fallback={<p>Loading…</p>}>
        <InvoiceFormWithSuppliers />
      </Suspense>
    </main>
  );
}

async function InvoiceFormWithSuppliers() {
  await connection();
  const suppliers = await listSuppliers();
  return <NewInvoice suppliers={suppliers.map(({ id, name }) => ({ id, name }))} />;
}
