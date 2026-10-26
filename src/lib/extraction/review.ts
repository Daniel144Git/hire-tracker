/** Required on every invoice: what a person must fill in when the PDF did not give it. */
const REQUIRED = ["supplierId", "number", "date", "type", "net", "vat", "gross"] as const;

/**
 * The invoice form's fields still to fill in after reading a PDF, with the message to show next
 * to each, so the person sees at once what the app could not read.
 */
export function missingFieldErrors(values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of REQUIRED) {
    if (values[field]) continue;
    errors[field] =
      field === "supplierId"
        ? "Not recognised: choose the supplier"
        : "Not read from the PDF: fill it in";
  }
  if (!Object.keys(values).some((name) => name.startsWith("lines."))) {
    errors["lines.0.description"] = "No lines read from the PDF: enter them";
  }
  return errors;
}
