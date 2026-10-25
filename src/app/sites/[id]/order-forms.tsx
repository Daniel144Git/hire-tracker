"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { buttonClass, Field, FormMessage } from "@/app/ui/field";
import { offHireAction, recordCollectionAction } from "../actions";

/** "Off-hire this item: date + collection no", in one step from the site page. */
export function OffHireForm({ orderId, jobNo }: { orderId: string; jobNo: string }) {
  const [state, action, pending] = useActionState(offHireAction, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form
      action={action}
      aria-label={`Off-hire ${jobNo}`}
      className="flex flex-col gap-2"
      noValidate
    >
      <input type="hidden" name="orderId" value={orderId} />
      <Field
        id={`off-hire-date-${orderId}`}
        name="offHireDate"
        type="date"
        label="Off-hire date"
        defaultValue={state.values?.offHireDate}
        error={errors.offHireDate}
      />
      <Field
        id={`off-hire-collection-${orderId}`}
        name="collectionNo"
        label="Collection no (optional)"
        defaultValue={state.values?.collectionNo}
        error={errors.collectionNo}
      />
      <div>
        <button type="submit" className={buttonClass} disabled={pending}>
          Off-hire
        </button>
      </div>
      {state.status === "error" && <FormMessage status={state.status} message={state.message} />}
    </form>
  );
}

export function CollectionForm({ orderId, jobNo }: { orderId: string; jobNo: string }) {
  const [state, action, pending] = useActionState(recordCollectionAction, initialFormState);

  return (
    <form
      action={action}
      aria-label={`Record collection for ${jobNo}`}
      className="flex flex-col gap-2"
      noValidate
    >
      <input type="hidden" name="orderId" value={orderId} />
      <Field
        id={`collection-no-${orderId}`}
        name="collectionNo"
        label="Collection no"
        defaultValue={state.values?.collectionNo}
        error={state.fieldErrors?.collectionNo}
      />
      <div>
        <button type="submit" className={buttonClass} disabled={pending}>
          Record collection
        </button>
      </div>
      {state.status === "error" && <FormMessage status={state.status} message={state.message} />}
    </form>
  );
}
