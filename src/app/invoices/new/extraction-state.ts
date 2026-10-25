import type { FormState } from "@/lib/form-state";

/** What reading an invoice PDF returns to the page: the form values to check, and warnings. */
export interface ExtractionState extends FormState {
  extraction?: {
    uploadId: string;
    fileName: string;
    /** The invoice form's fields, filled in from the PDF. */
    values: Record<string, string>;
    warnings: string[];
  };
}

export const initialExtractionState: ExtractionState = { status: "idle" };
