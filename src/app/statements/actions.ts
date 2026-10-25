"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { ConflictError, ValidationError } from "@/server/errors";
import { getStatement, importStatementPdf, markUnlistedAsPaid } from "@/server/services/statements";

/** Imports a statement PDF, then opens it. Errors stay on the form as one message. */
export async function importStatementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose the statement PDF first" };
  }
  let statementId: string;
  try {
    statementId = (await importStatementPdf(new Uint8Array(await file.arrayBuffer()))).id;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ConflictError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
  // redirect() works by throwing, so it stays outside the try/catch.
  redirect(`/statements/${statementId}`);
}

/** Marks paid the invoices this statement no longer lists, then shows the statement again. */
export async function markUnlistedAsPaidAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const statementId = String(formData.get("statementId") ?? "");
  const before = (await getStatement(statementId)).problems.filter(
    (problem) => problem.kind === "NOT_ON_STATEMENT",
  ).length;
  await markUnlistedAsPaid(statementId);
  refresh();
  return {
    status: "success",
    message: `Marked ${before} ${before === 1 ? "invoice" : "invoices"} as paid`,
  };
}
