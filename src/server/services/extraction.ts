import { db } from "@/server/db";
import { ValidationError } from "@/server/errors";
import { extractInvoice } from "@/lib/extraction/extract-invoice";
import type { InvoiceDraft, LayoutId } from "@/lib/extraction/types";
import { assertPdf, saveUpload } from "@/server/files/invoice-files";
import { readPdfText } from "@/server/pdf/read-pdf";

export interface ExtractionDto {
  /** Pass it when saving the invoice to keep the PDF with it. */
  uploadId: string;
  /** The layout the invoice was read with; null when the PDF could not be read. */
  layout: LayoutId | null;
  /** The supplier whose account number is printed on the invoice, when exactly one matches. */
  supplier: { id: string; name: string } | null;
  invoice: InvoiceDraft | null;
  /** What to check before saving. */
  warnings: string[];
}

/**
 * Reads an invoice PDF and keeps the file. Nothing is saved as an invoice here: the result is
 * a draft for a person to check, then save with POST /api/invoices and the upload id.
 */
export async function extractInvoiceFromPdf(bytes: Uint8Array): Promise<ExtractionDto> {
  assertPdf(bytes);
  let fragments;
  try {
    fragments = await readPdfText(bytes);
  } catch {
    const message = "The file could not be read as a PDF";
    throw new ValidationError(message, [{ path: ["file"], message }]);
  }
  const uploadId = await saveUpload(bytes);

  if (fragments.length === 0) {
    return unread(uploadId, "The PDF has no text (it may be a scan): enter the invoice by hand.");
  }
  const extraction = extractInvoice(fragments);
  if (!extraction) {
    return unread(
      uploadId,
      "The PDF is not in a layout the app can read: enter the invoice by hand.",
    );
  }

  const warnings = [...extraction.warnings];
  const supplier = await supplierByAccount(extraction.accountNo, warnings);
  if (supplier && extraction.invoice.number) {
    const existing = await db.invoice.findUnique({
      where: {
        supplierId_number: { supplierId: supplier.id, number: extraction.invoice.number },
      },
      select: { id: true },
    });
    if (existing) {
      warnings.unshift(
        `Invoice ${extraction.invoice.number} from ${supplier.name} is already recorded.`,
      );
    }
  }
  return { uploadId, layout: extraction.layout, supplier, invoice: extraction.invoice, warnings };
}

function unread(uploadId: string, warning: string): ExtractionDto {
  return { uploadId, layout: null, supplier: null, invoice: null, warnings: [warning] };
}

async function supplierByAccount(
  accountNo: string | undefined,
  warnings: string[],
): Promise<ExtractionDto["supplier"]> {
  if (!accountNo) {
    warnings.push("No account number found on the invoice: choose the supplier.");
    return null;
  }
  const suppliers = await db.supplier.findMany({
    where: { accountNo: accountNo.toUpperCase() },
    select: { id: true, name: true },
  });
  if (suppliers.length === 1) return suppliers[0];
  warnings.push(
    suppliers.length === 0
      ? `No supplier has account number ${accountNo}: choose the supplier, and add the account number to it.`
      : `More than one supplier has account number ${accountNo}: choose the supplier.`,
  );
  return null;
}
