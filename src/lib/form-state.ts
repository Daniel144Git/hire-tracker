/** What a Server Action returns to its form: a message and, on errors, one message per field. */
export interface FormState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** The submitted values, so the form keeps what the user typed when there is an error. */
  values?: Record<string, string>;
}

export const initialFormState: FormState = { status: "idle" };
