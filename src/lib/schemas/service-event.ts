import { z } from "zod";
import { identifierSchema, isoDateSchema, textSchema } from "./common";

export const SERVICE_KINDS = ["SERVICE", "INSPECTION", "REPAIR", "DAMAGE", "LOSS"] as const;

export const SERVICE_KIND_LABEL: Record<(typeof SERVICE_KINDS)[number], string> = {
  SERVICE: "Service",
  INSPECTION: "Inspection",
  REPAIR: "Repair",
  DAMAGE: "Damage",
  LOSS: "Loss",
};

export const serviceEventCreateSchema = z.strictObject({
  date: isoDateSchema,
  kind: z.enum(SERVICE_KINDS),
  /** The item it concerns, when known: its fleet code (E-code). */
  fleetCode: identifierSchema(40).optional(),
  description: textSchema(300),
  /** Who on site confirmed it. */
  confirmedBy: textSchema(100).optional(),
});

export type ServiceEventCreateInput = z.infer<typeof serviceEventCreateSchema>;
