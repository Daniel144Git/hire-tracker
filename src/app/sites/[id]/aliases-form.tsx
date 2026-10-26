"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { buttonClass, FormMessage } from "@/app/ui/field";
import { setAliasesAction } from "../actions";

/** The customer references a supplier prints for this site, one per line. */
export function AliasesForm({ siteId, aliases }: { siteId: string; aliases: string[] }) {
  const [state, action, pending] = useActionState(setAliasesAction, initialFormState);
  const error = state.fieldErrors?.aliases;

  return (
    <form
      action={action}
      aria-label="Site spellings"
      className="flex flex-col gap-2 sm:max-w-md"
      noValidate
    >
      <input type="hidden" name="siteId" value={siteId} />
      <label htmlFor="site-aliases" className="text-sm font-medium">
        Spellings, one per line
      </label>
      <textarea
        id="site-aliases"
        name="aliases"
        rows={4}
        defaultValue={state.values?.aliases ?? aliases.join("\n")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "site-aliases-error" : undefined}
        className="rounded border border-line-strong bg-background px-2 py-1"
      />
      {error && (
        <p id="site-aliases-error" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <div>
        <button type="submit" className={buttonClass} disabled={pending}>
          Save spellings
        </button>
      </div>
      <FormMessage status={state.status} message={state.message} />
    </form>
  );
}
