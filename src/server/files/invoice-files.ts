import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { NotFoundError, ValidationError } from "@/server/errors";

/**
 * Invoice PDFs are kept on disk, outside the database and outside git:
 *   <INVOICE_FILES_DIR>/uploads/<uploadId>.pdf   read, not yet saved as an invoice
 *   <INVOICE_FILES_DIR>/invoices/<invoiceId>.pdf  kept with a saved invoice
 * Invoice.filePath stores the path relative to INVOICE_FILES_DIR.
 */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function root(): string {
  return path.resolve(process.env.INVOICE_FILES_DIR ?? "storage/invoice-files");
}

function uploadPath(uploadId: string): string {
  // The id becomes part of a file path: only an id we generated is accepted.
  if (!UPLOAD_ID.test(uploadId)) {
    throw new ValidationError("The request is not valid", [
      { path: ["uploadId"], message: "Unknown upload" },
    ]);
  }
  return path.join(root(), "uploads", `${uploadId}.pdf`);
}

/** Rejects anything that is not a PDF of a sensible size, before it is stored or read. */
export function assertPdf(bytes: Uint8Array): void {
  const problem =
    bytes.byteLength === 0
      ? "The file is empty"
      : bytes.byteLength > MAX_PDF_BYTES
        ? `The file is larger than ${MAX_PDF_BYTES / 1024 / 1024} MB`
        : new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-"
          ? "The file is not a PDF"
          : undefined;
  if (problem) throw new ValidationError(problem, [{ path: ["file"], message: problem }]);
}

/** Stores an uploaded PDF until the invoice read from it is saved. Returns its upload id. */
export async function saveUpload(bytes: Uint8Array): Promise<string> {
  assertPdf(bytes);
  const uploadId = randomUUID();
  const file = uploadPath(uploadId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return uploadId;
}

/** Throws a validation error unless the upload exists. */
export async function assertUploadExists(uploadId: string): Promise<void> {
  try {
    await stat(uploadPath(uploadId));
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("The request is not valid", [
      { path: ["uploadId"], message: "Unknown upload" },
    ]);
  }
}

/** Moves an upload to the invoice it was saved as. Returns the path to store on the invoice. */
export async function keepUploadWithInvoice(uploadId: string, invoiceId: string): Promise<string> {
  const filePath = path.join("invoices", `${invoiceId}.pdf`);
  const target = path.join(root(), filePath);
  await mkdir(path.dirname(target), { recursive: true });
  await rename(uploadPath(uploadId), target);
  return filePath;
}

/** The PDF kept with an invoice. */
export async function readInvoiceFile(
  filePath: string,
  invoiceId: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const file = path.resolve(root(), filePath);
  if (!file.startsWith(root() + path.sep)) throw new NotFoundError("File of invoice", invoiceId);
  try {
    return Uint8Array.from(await readFile(file));
  } catch {
    throw new NotFoundError("File of invoice", invoiceId);
  }
}
