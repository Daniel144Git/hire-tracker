import { z } from "zod";
import { parseIsoDate } from "@/lib/charging/iso-date";
import { isoDateSchema, textSchema } from "./common";

export const suspensionCreateSchema = z
  .strictObject({
    periodFrom: isoDateSchema,
    periodTo: isoDateSchema,
    /** Working days the supplier credits on each hire line of the period. */
    freeDays: z.number().int().min(1).max(60),
    note: textSchema(200).optional(),
  })
  .superRefine((s, ctx) => {
    try {
      if (parseIsoDate(s.periodTo) < parseIsoDate(s.periodFrom)) {
        ctx.addIssue({
          code: "custom",
          message: "The end is before the start",
          path: ["periodTo"],
        });
      }
    } catch {
      // Invalid dates are already reported by isoDateSchema.
    }
  });

export type SuspensionCreateInput = z.infer<typeof suspensionCreateSchema>;
