"use client";

import { useActionState, useState } from "react";
import { initialFormState } from "@/lib/form-state";
import { CHARGE_TYPES, INVOICE_TYPES } from "@/lib/schemas/invoice";
import { buttonClass, Field, FormMessage, SelectField } from "@/app/ui/field";
import { createInvoiceAction } from "../actions";
import { CHARGE_TYPE_LABEL, INVOICE_TYPE_LABEL } from "../format";

interface Props {
  suppliers: { id: string; name: string }[];
}

const secondaryButtonClass = "rounded border border-gray-500 px-3 py-1 font-medium";

export function InvoiceForm({ suppliers }: Props) {
  const [state, action, pending] = useActionState(createInvoiceAction, initialFormState);
  // Each line has a stable key, so removing line 2 of 3 does not mix up the inputs of line 3.
  const [lineKeys, setLineKeys] = useState([0]);
  const [nextKey, setNextKey] = useState(1);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  if (suppliers.length === 0) return <p>Add a supplier first.</p>;

  const field = (name: string, label: string, props: Record<string, unknown> = {}) => (
    <Field
      id={`invoice-${name.replaceAll(".", "-")}`}
      name={name}
      label={label}
      defaultValue={values[name]}
      error={errors[name]}
      {...props}
    />
  );

  return (
    <form action={action} aria-label="Invoice" className="flex flex-col gap-6" noValidate>
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-lg font-medium">Header</legend>
        <SelectField
          id="invoice-supplier"
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
        {field("number", "Invoice number")}
        <SelectField
          id="invoice-type"
          name="type"
          label="Type"
          defaultValue={values.type}
          error={errors.type}
        >
          {INVOICE_TYPES.map((type) => (
            <option key={type} value={type}>
              {INVOICE_TYPE_LABEL[type]}
            </option>
          ))}
        </SelectField>
        {field("date", "Invoice date", { type: "date" })}
        {field("dueDate", "Due date (optional)", { type: "date" })}
        {field("jobNo", "Job number")}
        {field("lastInvoiceNo", "Last invoice number (optional)")}
        {field("customerRef", "Customer reference (optional)")}
        <div className="flex items-center gap-2 self-end pb-2">
          <input
            id="invoice-credit-note"
            name="isCreditNote"
            type="checkbox"
            defaultChecked={values.isCreditNote === "on"}
          />
          <label htmlFor="invoice-credit-note">Credit note</label>
        </div>
        {field("net", "Net total (£)", { type: "number", step: "0.01" })}
        {field("vat", "VAT total (£)", { type: "number", step: "0.01" })}
        {field("gross", "Gross total (£)", { type: "number", step: "0.01" })}
      </fieldset>

      {lineKeys.map((key, index) => (
        <fieldset key={key} className="grid gap-3 border-t border-gray-300 pt-4 sm:grid-cols-4">
          <legend className="mb-2 font-medium">Line {index + 1}</legend>
          {field(`lines.${index}.description`, "Description")}
          {field(`lines.${index}.fleetCode`, "Fleet code")}
          <SelectField
            id={`invoice-lines-${index}-chargeType`}
            name={`lines.${index}.chargeType`}
            label="Charge type"
            defaultValue={values[`lines.${index}.chargeType`]}
            error={errors[`lines.${index}.chargeType`]}
          >
            {CHARGE_TYPES.map((type) => (
              <option key={type} value={type}>
                {CHARGE_TYPE_LABEL[type]}
              </option>
            ))}
          </SelectField>
          {field(`lines.${index}.qty`, "Quantity", { type: "number", min: 1 })}
          {field(`lines.${index}.periodFrom`, "Period from", { type: "date" })}
          {field(`lines.${index}.periodTo`, "Period to", { type: "date" })}
          {field(`lines.${index}.weeks`, "Weeks", { type: "number", min: 0 })}
          {field(`lines.${index}.days`, "Days", { type: "number", min: 0, max: 4 })}
          {field(`lines.${index}.rate`, "Rate (£/week)", { type: "number", step: "0.01" })}
          {field(`lines.${index}.net`, "Net (£)", { type: "number", step: "0.01" })}
          {field(`lines.${index}.vat`, "VAT (£)", { type: "number", step: "0.01" })}
          {lineKeys.length > 1 && (
            <div className="self-end">
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => setLineKeys(lineKeys.filter((k) => k !== key))}
              >
                Remove line {index + 1}
              </button>
            </div>
          )}
        </fieldset>
      ))}

      <div className="flex gap-3">
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => {
            setLineKeys([...lineKeys, nextKey]);
            setNextKey(nextKey + 1);
          }}
        >
          Add line
        </button>
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? "Saving…" : "Save invoice"}
        </button>
      </div>
      <FormMessage status={state.status} message={state.message} />
    </form>
  );
}
