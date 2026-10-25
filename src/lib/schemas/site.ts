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

/** The customer references a supplier uses for a site; replaces the site's list. */
export const siteAliasesSchema = z.strictObject({
  aliases: z.array(textSchema(100)).max(50),
});

/** What an invoice says about its site: at least one of the two. */
export const recognizeSiteQuerySchema = z
  .strictObject({
    customerRef: textSchema(200).optional(),
    deliveryAddress: textSchema(300).optional(),
  })
  .refine((query) => query.customerRef || query.deliveryAddress, {
    message: "Give a customer reference or a delivery address",
  });
