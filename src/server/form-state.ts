import { ZodError } from "zod";
import { OrderRuleError } from "@/lib/orders/status";
import type { FormState } from "@/lib/form-state";
import { ConflictError, NotFoundError, ValidationError, type FieldIssue } from "./errors";

export type { FormState };

/** Errors that belong to one field, by error code. */
const FIELD_BY_CODE: Record<string, string> = {
  DUPLICATE_SITE_CODE: "code",
  DUPLICATE_JOB_NO: "supplierJobNo",
  DUPLICATE_SUPPLIER: "name",
  DUPLICATE_INVOICE: "number",
  OFF_HIRE_BEFORE_START: "offHireDate",
};

/** Field name in the form. The new-order form has one item, so "items.0.weeklyRate" -> "weeklyRate". */
function fieldName(path: FieldIssue["path"]): string {
  const parts = path[0] === "items" ? path.slice(2) : path;
  return parts.join(".") || "form";
}

function fieldErrorsFrom(issues: FieldIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const name = fieldName(issue.path);
    errors[name] ??= issue.message;
  }
  return errors;
}

/** Turns a known error into a FormState. Unknown errors are re-thrown: they are bugs, not user mistakes. */
export function toFormState(error: unknown, values: Record<string, string>): FormState {
  const base = { status: "error" as const, values };
  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => ({
      path: issue.path.map((part) => (typeof part === "symbol" ? String(part) : part)),
      message: issue.message,
    }));
    return {
      ...base,
      message: "Please correct the highlighted fields",
      fieldErrors: fieldErrorsFrom(issues),
    };
  }
  if (error instanceof ValidationError) {
    return { ...base, message: error.message, fieldErrors: fieldErrorsFrom(error.issues) };
  }
  if (error instanceof ConflictError || error instanceof OrderRuleError) {
    const field = FIELD_BY_CODE[error.code];
    return {
      ...base,
      message: error.message,
      fieldErrors: field ? { [field]: error.message } : {},
    };
  }
  if (error instanceof NotFoundError) {
    return { ...base, message: error.message };
  }
  throw error;
}

/** Reads text fields from a form; empty fields are left out so optional fields stay optional. */
export function readForm(formData: FormData, names: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of names) {
    const value = formData.get(name);
    if (typeof value === "string" && value.trim() !== "") values[name] = value;
  }
  return values;
}

/** Every non-empty text field of a form, by name, e.g. { "number": "INV-1", "lines.0.net": "210" }. */
export function readAllFields(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value === "string" && value.trim() !== "" && !name.startsWith("$ACTION")) {
      values[name] = value;
    }
  }
  return values;
}
