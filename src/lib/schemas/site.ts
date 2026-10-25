import { z } from "zod";
import { hasAtLeastOneField, textSchema } from "./common";

export const siteCreateSchema = z.strictObject({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,6}$/, "Code must be 2 to 6 letters or digits"),
  name: textSchema(100),
  deliveryAddress: textSchema(200).optional(),
});

export const siteUpdateSchema = siteCreateSchema
  .partial()
  .refine(hasAtLeastOneField, { message: "Provide at least one field to update" });

export type SiteCreateInput = z.infer<typeof siteCreateSchema>;
export type SiteUpdateInput = z.infer<typeof siteUpdateSchema>;
