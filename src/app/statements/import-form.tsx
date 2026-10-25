"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { buttonClass, FormMessage } from "@/app/ui/field";
import { importStatementAction } from "./actions";

export function ImportStatementForm() {
  const [state, action, pending] = useActionState(importStatementAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="statement-pdf" className="text-sm font-medium">
            Statement PDF
          </label>
          <input
            id="statement-pdf"
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            className="text-sm"
          />
        </div>
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? "Importing…" : "Import statement"}
        </button>
      </div>
      <FormMessage status={state.status} message={state.message} />
    </form>
  );
}
