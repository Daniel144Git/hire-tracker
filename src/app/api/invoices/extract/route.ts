import { ValidationError } from "@/server/errors";
import { route } from "@/server/http";
import { extractInvoiceFromPdf } from "@/server/services/extraction";

/**
 * POST /api/invoices/extract, multipart/form-data with the PDF as "file" -> 201.
 * Reads the invoice and keeps the file; nothing is saved as an invoice. The response is a
 * draft to check and then send to POST /api/invoices with its uploadId.
 */
export const POST = route(async (request: Request) => {
  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    // Not multipart: reported below like a missing file.
  }
  if (!(file instanceof File)) {
    const message = 'Attach the invoice PDF as the form field "file"';
    throw new ValidationError(message, [{ path: ["file"], message }]);
  }
  const extraction = await extractInvoiceFromPdf(new Uint8Array(await file.arrayBuffer()));
  return Response.json(extraction, { status: 201 });
});
