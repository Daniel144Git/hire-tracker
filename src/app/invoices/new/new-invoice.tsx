"use client";

import { useActionState } from "react";
import { buttonClass, FormMessage } from "@/app/ui/field";
import { extractInvoiceAction } from "../actions";
import { initialExtractionState } from "./extraction-state";
import { InvoiceForm } from "./invoice-form";

interface Props {
  suppliers: { id: string; name: string }[];
}

/**
 * Read an invoice PDF to fill in the form, or type the invoice in. Either way the person checks
 * the form and saves it: what was read from the PDF is never saved without being seen.
 */
export function NewInvoice({ suppliers }: Props) {
  const [state, action, pending] = useActionState(extractInvoiceAction, initialExtractionState);
  const extraction = state.extraction;

  return (
    <>
      <section aria-labelledby="pdf-heading" className="flex flex-col gap-3">
        <h2 id="pdf-heading" className="text-lg font-medium">
          Read an invoice PDF
        </h2>
        <form action={action} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="invoice-pdf" className="text-sm font-medium">
              Invoice PDF
            </label>
            <input
              id="invoice-pdf"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              className="text-sm"
            />
          </div>
          <button type="submit" className={buttonClass} disabled={pending}>
            {pending ? "Reading…" : "Read PDF"}
          </button>
        </form>
        <FormMessage status={state.status} message={state.message} />
        {extraction && extraction.warnings.length > 0 && (
          <div
            role="region"
            aria-labelledby="warnings-heading"
            className="rounded border border-amber-600 p-3"
          >
            <h3 id="warnings-heading" className="font-medium">
              Check before saving
            </h3>
            <ul className="list-disc pl-5">
              {extraction.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="form-heading" className="flex flex-col gap-3">
        <h2 id="form-heading" className="text-lg font-medium">
          {extraction ? `Invoice read from ${extraction.fileName}` : "Or type the invoice in"}
        </h2>
        <InvoiceForm
          // A new PDF starts a new form, filled in from that PDF.
          key={extraction?.uploadId ?? "blank"}
          suppliers={suppliers}
          initialValues={extraction?.values}
          uploadId={extraction?.uploadId}
        />
      </section>
    </>
  );
}
