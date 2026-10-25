import { z } from "zod";
import { identifierSchema, textSchema } from "./common";

export const PAYMENT_TERMS = ["END_OF_NEXT_MONTH", "NET_N"] as const;

export const supplierCreateSchema = z
  .strictObject({
    name: textSchema(100),
    accountNo: identifierSchema(40).optional(),
    chargeBankHolidays: z.boolean().optional(),
    minChargeDays: z.number().int().min(0).max(20).optional(),
    damageWaiverPct: z.number().min(0).max(100).optional(),
    paymentTerms: z.enum(PAYMENT_TERMS).optional(),
    paymentTermsDays: z.number().int().min(1).max(120).optional(),
  })
  .refine((s) => s.paymentTerms !== "NET_N" || s.paymentTermsDays !== undefined, {
    message: "paymentTermsDays is required when paymentTerms is NET_N",
    path: ["paymentTermsDays"],
  });

export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;
