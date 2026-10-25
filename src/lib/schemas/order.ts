import { z } from "zod";
import {
  hasAtLeastOneField,
  identifierSchema,
  isoDateSchema,
  poundsSchema,
  textSchema,
} from "./common";

export const TRADES = ["MECH", "ELEC", "VENT", "BMS"] as const;
export const tradeSchema = z.enum(TRADES);

export const hireItemSchema = z.strictObject({
  description: textSchema(200),
  /** The physical item's id. Optional: a line of identical items may have none. */
  fleetCode: identifierSchema(40).optional(),
  qty: z.number().int().min(1).default(1),
  /** Agreed rate in pounds per week of 5 working days. */
  weeklyRate: poundsSchema,
  despatchNo: identifierSchema(40).optional(),
  despatchDate: isoDateSchema.optional(),
  isAccessory: z.boolean().default(false),
});

export const orderCreateSchema = z.strictObject({
  supplierId: z.string().min(1, "Required"),
  siteId: z.string().min(1, "Required"),
  supplierJobNo: identifierSchema(40),
  trade: tradeSchema,
  startDate: isoDateSchema,
  /** Left out: taken from the supplier (true when the supplier charges a damage waiver). */
  damageWaiverApplies: z.boolean().optional(),
  items: z.array(hireItemSchema).min(1, "An order needs at least one item").max(50),
});

/** Only these fields can be edited directly. Status and dates change through off-hire. */
export const orderUpdateSchema = z
  .strictObject({
    trade: tradeSchema.optional(),
    damageWaiverApplies: z.boolean().optional(),
  })
  .refine(hasAtLeastOneField, { message: "Provide at least one field to update" });

export const offHireSchema = z.strictObject({
  offHireDate: isoDateSchema,
  collectionNo: identifierSchema(40).optional(),
});

export const collectionSchema = z.strictObject({
  collectionNo: identifierSchema(40),
});

export type HireItemInput = z.infer<typeof hireItemSchema>;
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;
export type OffHireInput = z.infer<typeof offHireSchema>;
export type CollectionInput = z.infer<typeof collectionSchema>;
