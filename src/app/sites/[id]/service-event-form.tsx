"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { SERVICE_KIND_LABEL, SERVICE_KINDS } from "@/lib/schemas/service-event";
import { buttonClass, Field, FormMessage, SelectField } from "@/app/ui/field";
import { createServiceEventAction } from "../actions";

/** Records a service, inspection, repair, damage or loss on site (R9 matches charges to it). */
export function ServiceEventForm({ siteId }: { siteId: string }) {
  const [state, action, pending] = useActionState(createServiceEventAction, initialFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={action} aria-label="Record an event" className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="siteId" value={siteId} />
      <div className="grid gap-3 sm:grid-cols-5">
        <Field
          id="event-date"
          name="date"
          type="date"
          label="Date"
          defaultValue={values.date}
          error={errors.date}
        />
        <SelectField
          id="event-kind"
          name="kind"
          label="What happened"
          defaultValue={values.kind}
          error={errors.kind}
        >
          {SERVICE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {SERVICE_KIND_LABEL[kind]}
            </option>
          ))}
        </SelectField>
        <Field
          id="event-fleet-code"
          name="fleetCode"
          label="Fleet code (optional)"
          defaultValue={values.fleetCode}
          error={errors.fleetCode}
        />
        <Field
          id="event-description"
          name="description"
          label="Description"
          defaultValue={values.description}
          error={errors.description}
        />
        <Field
          id="event-confirmed-by"
          name="confirmedBy"
          label="Confirmed by (optional)"
          defaultValue={values.confirmedBy}
          error={errors.confirmedBy}
        />
      </div>
      <div>
        <button type="submit" className={buttonClass} disabled={pending}>
          Record event
        </button>
      </div>
      <FormMessage status={state.status} message={state.message} />
    </form>
  );
}
