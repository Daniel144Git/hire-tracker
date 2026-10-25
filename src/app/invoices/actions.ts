"use server";

import { redirect } from "next/navigation";
import { readAllFields, toFormState, type FormState } from "@/server/form-state";
import { createInvoice } from "@/server/services/invoices";

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
