import { z } from "zod";

/** An empty value, as an empty form field sends it, means "no filter". */
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

/** An optional id to filter by: a supplier, a site. */
export const optionalId = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be YYYY-MM");

export const optionalMonth = z.preprocess(emptyToUndefined, monthSchema.optional());

/** "true" in a query string; anything else, or nothing, is false. */
export const queryFlag = z.preprocess(
  (value) => value === "true" || value === "on" || value === true,
  z.boolean(),
);
