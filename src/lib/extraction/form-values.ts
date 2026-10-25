import type { InvoiceDraft } from "./types";

/**
 * Flattens an invoice read from a PDF into the invoice form's field names ("number",
 * "lines.0.net", ...), so the form opens filled in for the person to check.
 */
export function toFormValues(
  draft: InvoiceDraft,
  supplierId: string | null,
): Record<string, string> {
  const values: Record<string, string> = {};
  const put = (name: string, value: unknown) => {
    if (value !== undefined && value !== null) values[name] = String(value);
  };
  const { lines, isCreditNote, ...header } = draft;
  put("supplierId", supplierId);
  for (const [name, value] of Object.entries(header)) put(name, value);
  if (isCreditNote) values.isCreditNote = "on";
  lines.forEach((line, index) => {
    for (const [name, value] of Object.entries(line)) put(`lines.${index}.${name}`, value);
  });
  return values;
}
