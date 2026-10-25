"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { buttonClass, Field, FormMessage, SelectField } from "@/app/ui/field";
import { changeFleetCodeAction } from "../actions";

/**
 * Records that an item now has a new fleet code (E-code), e.g. after the supplier swapped it.
 * The old code stays in the item's history, so invoices with either code link to the item.
 */
export function FleetCodeForm({ items }: { items: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState(changeFleetCodeAction, initialFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  if (items.length === 0) return <p>No items on this site.</p>;

  return (
    <form action={action} aria-label="New fleet code" className="flex flex-col gap-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-4">
        <SelectField
          id="swap-item"
          name="item"
          label="Item"
          defaultValue={values.item}
          error={errors.item}
        >
          {items.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </SelectField>
        <Field
          id="swap-code"
          name="newCode"
          label="New fleet code"
          defaultValue={values.newCode}
          error={errors.newCode}
        />
        <Field
          id="swap-date"
          name="changedOn"
          type="date"
          label="Changed on"
          defaultValue={values.changedOn}
          error={errors.changedOn}
        />
        <Field
          id="swap-note"
          name="note"
          label="Note (optional)"
          defaultValue={values.note}
          error={errors.note}
        />
      </div>
      <div>
        <button type="submit" className={buttonClass} disabled={pending}>
          Record new fleet code
        </button>
      </div>
      <FormMessage status={state.status} message={state.message} />
    </form>
  );
}
