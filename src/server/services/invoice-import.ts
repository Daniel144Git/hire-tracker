import { ZodError } from "zod";
import { db } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { toFormValues } from "@/lib/extraction/form-values";
import { missingFieldErrors } from "@/lib/extraction/review";
import { deleteUpload } from "@/server/files/invoice-files";
import { extractInvoiceFromPdf } from "./extraction";
import { createInvoice } from "./invoices";

export type ImportResult =
  | { fileName: string; status: "SAVED"; invoice: { id: string; number: string } }
  | {
      fileName: string;
      status: "ALREADY_RECORDED";
      invoice: { id: string; number: string };
      message: string;
    }
  | { fileName: string; status: "TO_CHECK"; draftId: string; warnings: string[] };

/**
 * One PDF of a batch. An invoice read cleanly (a known layout, no warnings, the supplier found
 * by its account number, not recorded yet) is saved with its PDF and checked, like one entered
 * by hand. An invoice already recorded is reported and nothing is kept. Anything else waits on
 * the "To check" list, with the PDF and what was read, until a person completes and saves it:
 * nothing doubtful is saved unseen.
 */
export async function importInvoicePdf(bytes: Uint8Array, fileName: string): Promise<ImportResult> {
  const extraction = await extractInvoiceFromPdf(bytes);
  const { invoice, supplier, uploadId } = extraction;
  const warnings = [...extraction.warnings];

  if (invoice?.number && supplier) {
    const existing = await db.invoice.findUnique({
      where: { supplierId_number: { supplierId: supplier.id, number: invoice.number } },
      select: { id: true, number: true },
    });
    if (existing) {
      await deleteUpload(uploadId);
      return {
        fileName,
        status: "ALREADY_RECORDED",
        invoice: existing,
        message: `Invoice ${existing.number} from ${supplier.name} is already recorded`,
      };
    }
  }

  if (invoice && supplier && warnings.length === 0) {
    try {
      const saved = await createInvoice({ ...invoice, supplierId: supplier.id, uploadId });
      return { fileName, status: "SAVED", invoice: { id: saved.id, number: saved.number } };
    } catch (error) {
      // Read cleanly but not valid as an invoice: a person decides.
      if (error instanceof ZodError) warnings.push(...error.issues.map((i) => i.message));
      else if (error instanceof ValidationError || error instanceof ConflictError) {
        warnings.push(error.message);
      } else throw error;
    }
  }

  const values = invoice ? toFormValues(invoice, supplier?.id ?? null) : {};
  const draft = await db.invoiceDraft.create({
    data: {
      uploadId,
      fileName,
      values: JSON.stringify(values),
      warnings: JSON.stringify(warnings),
    },
  });
  return { fileName, status: "TO_CHECK", draftId: draft.id, warnings };
}

function toDraftDto(draft: {
  id: string;
  uploadId: string;
  fileName: string;
  values: string;
  warnings: string;
  createdAt: Date;
}) {
  const values = JSON.parse(draft.values) as Record<string, string>;
  return {
    id: draft.id,
    uploadId: draft.uploadId,
    fileName: draft.fileName,
    values,
    warnings: JSON.parse(draft.warnings) as string[],
    /** The required fields still empty, with what to tell the person. */
    missing: missingFieldErrors(values),
    createdAt: draft.createdAt.toISOString(),
  };
}

export type InvoiceDraftDto = ReturnType<typeof toDraftDto>;

/** GET /api/invoices/drafts: the invoices waiting to be checked, oldest first. */
export async function listInvoiceDrafts(): Promise<InvoiceDraftDto[]> {
  const drafts = await db.invoiceDraft.findMany({ orderBy: { createdAt: "asc" } });
  return drafts.map(toDraftDto);
}

export async function getInvoiceDraft(id: string): Promise<InvoiceDraftDto> {
  const draft = await db.invoiceDraft.findUnique({ where: { id } });
  if (!draft) throw new NotFoundError("Invoice to check", id);
  return toDraftDto(draft);
}

/** DELETE /api/invoices/drafts/:id: not an invoice to keep; its PDF is deleted too. */
export async function discardInvoiceDraft(id: string): Promise<void> {
  const draft = await getInvoiceDraft(id);
  await db.invoiceDraft.delete({ where: { id } });
  await deleteUpload(draft.uploadId);
}
