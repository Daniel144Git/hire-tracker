"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { buttonClass, Field, FormMessage } from "@/app/ui/field";
import { createSiteAction } from "./actions";

export function CreateSiteForm() {
  const [state, action, pending] = useActionState(createSiteAction, initialFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={action} className="flex flex-col gap-3 sm:max-w-md" noValidate>
      <Field
        id="site-code"
        name="code"
        label="Code"
        defaultValue={values.code}
        error={errors.code}
        required
      />
      <Field
        id="site-name"
        name="name"
        label="Name"
        defaultValue={values.name}
        error={errors.name}
        required
      />
      <Field
        id="site-address"
        name="deliveryAddress"
        label="Delivery address"
        defaultValue={values.deliveryAddress}
        error={errors.deliveryAddress}
      />
      <div>
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? "Adding…" : "Add site"}
        </button>
      </div>
      <FormMessage status={state.status} message={state.message} />
    </form>
  );
}
