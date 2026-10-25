"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { buttonClass, FormMessage } from "@/app/ui/field";
import { markUnlistedAsPaidAction } from "../actions";

/** Marks paid the invoices the statement leaves out; the button shows only when there are some. */
export function MarkPaidForm({ statementId, count }: { statementId: string; count: number }) {
  const [state, action, pending] = useActionState(markUnlistedAsPaidAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="statementId" value={statementId} />
      {count > 0 && (
        <>
          <p className="text-sm">
            The supplier no longer lists {count} of our unpaid{" "}
            {count === 1 ? "invoice" : "invoices"} dated before this statement: they have been paid
            or settled.
          </p>
          <div>
            <button type="submit" className={buttonClass} disabled={pending}>
              {pending
                ? "Marking…"
                : `Mark the ${count} ${count === 1 ? "invoice" : "invoices"} not on this statement as paid`}
            </button>
          </div>
        </>
      )}
      <FormMessage status={state.status} message={state.message} />
    </form>
  );
}
