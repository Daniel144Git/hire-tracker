"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { TRADES } from "@/lib/schemas/order";
import { buttonClass, Field, FormMessage, SelectField } from "@/app/ui/field";
import { createOrderAction } from "../actions";

interface Props {
  siteId: string;
  suppliers: { id: string; name: string }[];
}

/** A new hire order with its main item. Accessories can be added later through the API. */
export function CreateOrderForm({ siteId, suppliers }: Props) {
  const [state, action, pending] = useActionState(createOrderAction, initialFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  if (suppliers.length === 0) {
    return <p>Add a supplier first: there is no supplier to hire from.</p>;
  }

  return (
    <form action={action} aria-label="New hire order" className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="siteId" value={siteId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id="order-supplier"
          name="supplierId"
          label="Supplier"
          defaultValue={values.supplierId}
          error={errors.supplierId}
        >
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </SelectField>
        <Field
          id="order-job-no"
          name="supplierJobNo"
          label="Supplier job number"
          defaultValue={values.supplierJobNo}
          error={errors.supplierJobNo}
        />
        <SelectField
          id="order-trade"
          name="trade"
          label="Trade"
          defaultValue={values.trade}
          error={errors.trade}
        >
          {TRADES.map((trade) => (
            <option key={trade} value={trade}>
              {trade}
            </option>
          ))}
        </SelectField>
        <Field
          id="order-start"
          name="startDate"
          type="date"
          label="Start of hire"
          defaultValue={values.startDate}
          error={errors.startDate}
        />
        <Field
          id="order-description"
          name="description"
          label="Item description"
          defaultValue={values.description}
          error={errors.description}
        />
        <Field
          id="order-fleet-code"
          name="fleetCode"
          label="Fleet code"
          defaultValue={values.fleetCode}
          error={errors.fleetCode}
        />
        <Field
          id="order-qty"
          name="qty"
          type="number"
          min={1}
          label="Quantity"
          defaultValue={values.qty ?? "1"}
          error={errors.qty}
        />
        <Field
          id="order-rate"
          name="weeklyRate"
          type="number"
          min={0}
          step="0.01"
          label="Weekly rate (£)"
          defaultValue={values.weeklyRate}
          error={errors.weeklyRate}
        />
      </div>
      <div>
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? "Adding…" : "Add hire order"}
        </button>
      </div>
      <FormMessage status={state.status} message={state.message} />
    </form>
  );
}
