import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

const controlClass =
  "rounded border border-line-strong px-2 py-1 aria-[invalid=true]:border-red-700 dark:aria-[invalid=true]:border-red-400 bg-background";

interface FieldProps {
  id: string;
  label: string;
  error?: string;
}

/** A labelled input. Its error is linked with aria-describedby, so screen readers announce it. */
export function Field({
  id,
  label,
  error,
  ...input
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        className={controlClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...input}
      />
      <FieldError id={id} error={error} />
    </div>
  );
}

export function SelectField({
  id,
  label,
  error,
  children,
  ...select
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        className={controlClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...select}
      >
        {children}
      </select>
      <FieldError id={id} error={error} />
    </div>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="text-sm text-red-700 dark:text-red-400">
      {error}
    </p>
  );
}

/** The result of a form: errors are an alert, success is a polite status message. */
export function FormMessage({ status, message }: { status: string; message?: string }) {
  if (!message || status === "idle") return null;
  return status === "error" ? (
    <p role="alert" className="text-sm text-red-700 dark:text-red-400">
      {message}
    </p>
  ) : (
    <p role="status" className="text-sm text-green-800 dark:text-green-400">
      {message}
    </p>
  );
}

export const buttonClass =
  "rounded bg-blue-700 px-3 py-1 font-medium text-white hover:bg-blue-800 disabled:opacity-60";
