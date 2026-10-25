"use server";

import { redirect } from "next/navigation";
import { readAllFields, toFormState, type FormState } from "@/server/form-state";
import { toFormValues } from "@/lib/extraction/form-values";
import { ValidationError } from "@/server/errors";
import { extractInvoiceFromPdf } from "@/server/services/extraction";
import { createInvoice } from "@/server/services/invoices";
import type { ExtractionState } from "./new/extraction-state";

const NUMBER_FIELDS = new Set(["qty", "weeks", "days", "rate", "net", "vat"]);
const HEADER_MONEY_FIELDS = new Set(["net", "vat", "gross"]);

/**
 * Turns the flat form fields ("number", "lines.0.net", "lines.1.description", ...) into the
 * JSON shape the invoice service expects, with numbers as numbers.
 */
function toInvoiceInput(values: Record<string, string>) {
  const header: Record<string, unknown> = {};
  const lines: Record<string, unknown>[] = [];
  for (const [name, value] of Object.entries(values)) {
    const lineField = /^lines\.(\d+)\.(\w+)$/.exec(name);
    if (lineField) {
      const [, index, field] = lineField;
      lines[Number(index)] ??= {};
      lines[Number(index)][field] = NUMBER_FIELDS.has(field) ? Number(value) : value;
    } else {
      header[name] = HEADER_MONEY_FIELDS.has(name) ? Number(value) : value;
    }
  }
  if (header.isCreditNote !== undefined) header.isCreditNote = header.isCreditNote === "on";
  return { ...header, lines: lines.filter(Boolean) };
}

export async function createInvoiceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = readAllFields(formData);
  let invoiceId: string;
  try {
    invoiceId = (await createInvoice(toInvoiceInput(values))).id;
  } catch (error) {
    return toFormState(error, values);
  }
  // redirect() works by throwing, so it stays outside the try/catch.
  redirect(`/invoices/${invoiceId}`);
}

/**
 * Reads the uploaded PDF and returns the invoice form's values for a person to check. Nothing
 * is saved yet; the PDF is kept and goes with the invoice when the form is saved.
 */
export async function extractInvoiceAction(
  _prev: ExtractionState,
  formData: FormData,
): Promise<ExtractionState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose the invoice PDF first" };
  }
  try {
    const result = await extractInvoiceFromPdf(new Uint8Array(await file.arrayBuffer()));
    const extraction = {
      uploadId: result.uploadId,
      fileName: file.name,
      values: result.invoice ? toFormValues(result.invoice, result.supplier?.id ?? null) : {},
      warnings: result.warnings,
    };
    if (!result.invoice) {
      return {
        status: "error",
        message: "Could not read the invoice. Enter it below: the PDF will be kept with it.",
        extraction,
      };
    }
    const from = result.supplier ? ` from ${result.supplier.name}` : "";
    return {
      status: "success",
      message: `Read invoice ${result.invoice.number ?? "(no number)"}${from}. Check every field below, then save it.`,
      extraction,
    };
  } catch (error) {
    if (error instanceof ValidationError) return { status: "error", message: error.message };
    throw error;
  }
}
