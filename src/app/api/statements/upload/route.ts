import { ValidationError } from "@/server/errors";
import { route } from "@/server/http";
import { importStatementPdf } from "@/server/services/statements";

/** POST /api/statements/upload, multipart/form-data with the PDF as "file" -> 201. */
export const POST = route(async (request: Request) => {
  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    // Not multipart: reported below like a missing file.
  }
  if (!(file instanceof File)) {
    const message = 'Attach the statement PDF as the form field "file"';
    throw new ValidationError(message, [{ path: ["file"], message }]);
  }
  const statement = await importStatementPdf(new Uint8Array(await file.arrayBuffer()));
  return Response.json(statement, { status: 201 });
});
