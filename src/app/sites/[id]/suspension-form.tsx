"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { buttonClass, Field, FormMessage } from "@/app/ui/field";
import { createSuspensionAction } from "../actions";

/** Records a period when the site was closed and the supplier credits free days. */
export function SuspensionForm({ siteId }: { siteId: string }) {
  const [state, action, pending] = useActionState(createSuspensionAction, initialFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form
      action={action}
      aria-label="Record a suspension"
      className="flex flex-col gap-3"
      noValidate
    >
      <input type="hidden" name="siteId" value={siteId} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Field
          id="suspension-from"
          name="periodFrom"
          type="date"
          label="From"
          defaultValue={values.periodFrom}
          error={errors.periodFrom}
        />
        <Field
          id="suspension-to"
          name="periodTo"
          type="date"
          label="To"
          defaultValue={values.periodTo}
          error={errors.periodTo}
        />
        <Field
          id="suspension-days"
          name="freeDays"
          type="number"
          min={1}
          label="Free days credited"
          defaultValue={values.freeDays}
          error={errors.freeDays}
        />
        <Field
          id="suspension-note"
          name="note"
          label="Note (optional)"
          defaultValue={values.note}
          error={errors.note}
        />
      </div>
      <div>
        <button type="submit" className={buttonClass} disabled={pending}>
          Record suspension
        </button>
      </div>
      <FormMessage status={state.status} message={state.message} />
    </form>
  );
}
