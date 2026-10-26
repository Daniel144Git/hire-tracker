import { ValidationError } from "@/server/errors";
import { route } from "@/server/http";
import { importInvoicePdf } from "@/server/services/invoice-import";

/**
 * POST /api/invoices/import, multipart/form-data with one PDF as "file": one PDF of a batch.
 * 201 when it was saved or kept to check, 200 when it is already recorded. See the service.
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
  const result = await importInvoicePdf(new Uint8Array(await file.arrayBuffer()), file.name);
  return Response.json(result, { status: result.status === "ALREADY_RECORDED" ? 200 : 201 });
});
