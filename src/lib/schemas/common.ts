import { z } from "zod";
import { parseIsoDate } from "@/lib/charging/iso-date";
import { toPence } from "@/lib/money";

/** A real calendar date written as YYYY-MM-DD. */
export const isoDateSchema = z.string().refine(
  (value) => {
    try {
      parseIsoDate(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Must be a real date in YYYY-MM-DD format" },
);

/** An amount in pounds, zero or more, with at most two decimal places. */
export const poundsSchema = z
  .number()
  .min(0)
  .refine(
    (value) => {
      try {
        toPence(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Must have at most 2 decimal places" },
  );

/** A short identifier such as a code or a number: trimmed and upper-cased. */
export function identifierSchema(maxLength: number) {
  return z.string().trim().toUpperCase().min(1, "Required").max(maxLength);
}

/** A free-text field: trimmed and not empty. */
export function textSchema(maxLength: number) {
  return z.string().trim().min(1, "Required").max(maxLength);
}

export function hasAtLeastOneField(value: object): boolean {
  return Object.keys(value).length > 0;
}
