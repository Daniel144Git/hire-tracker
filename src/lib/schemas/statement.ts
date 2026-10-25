import { z } from "zod";
import { round2 } from "@/lib/money";
import { money } from "@/lib/reconciliation/helpers";
import { identifierSchema, isoDateSchema, moneySchema, textSchema } from "./common";

export const statementLineSchema = z.strictObject({
  invoiceDate: isoDateSchema,
  jobNo: identifierSchema(40).optional(),
  invoiceNo: identifierSchema(40),
  customerRef: textSchema(200).optional(),
  /** Debit positive, credit negative, as the supplier lists it. */
  amount: moneySchema,
});

export const statementCreateSchema = z
  .strictObject({
    supplierId: z.string({ error: "Required" }).min(1, "Required"),
    date: isoDateSchema,
    /** The total printed on the statement: when given, the lines must add up to it. */
    total: moneySchema.optional(),
    lines: z.array(statementLineSchema).max(2000),
  })
  .superRefine((statement, ctx) => {
    if (statement.total === undefined) return;
    const sum = round2(statement.lines.reduce((total, line) => total + line.amount, 0));
    if (sum !== statement.total) {
      ctx.addIssue({
        code: "custom",
        path: ["total"],
        message: `The lines add up to ${money(sum)}, not the total of ${money(statement.total)}`,
      });
    }
  });

export type StatementCreateInput = z.infer<typeof statementCreateSchema>;
