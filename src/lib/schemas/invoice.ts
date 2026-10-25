import { z } from "zod";
import { parseIsoDate } from "@/lib/charging/iso-date";
import { identifierSchema, isoDateSchema, moneySchema, poundsSchema, textSchema } from "./common";
import { tradeSchema } from "./order";

export const INVOICE_TYPES = ["CONTINUATION", "RETURN", "SALE"] as const;
export const CHARGE_TYPES = ["HIRE", "DAMAGE_WAIVER", "TRANSPORT", "SALE", "OTHER"] as const;

export const invoiceLineSchema = z
  .strictObject({
    description: textSchema(200),
    fleetCode: identifierSchema(40).optional(),
    qty: z.number().int().min(1).default(1),
    /** As printed. On a credit note From can be later than To ("31/08 to 27/08"). */
    periodFrom: isoDateSchema.optional(),
    periodTo: isoDateSchema.optional(),
    /** The "N wks M days" printed on the line. */
    weeks: z.number().int().min(0).optional(),
    days: z.number().int().min(0).max(4).optional(),
    rate: poundsSchema.optional(),
    chargeType: z.enum(CHARGE_TYPES),
    net: moneySchema,
    vat: moneySchema,
    /** Overrides the order's trade for cost allocation. */
    trade: tradeSchema.optional(),
  })
  .superRefine((line, ctx) => {
    if ((line.periodFrom === undefined) !== (line.periodTo === undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "Give both ends of the billing period, or neither",
        path: [line.periodFrom === undefined ? "periodFrom" : "periodTo"],
      });
    }
  });

export const invoiceCreateSchema = z
  .strictObject({
    supplierId: z.string().min(1, "Required"),
    number: identifierSchema(40),
    date: isoDateSchema,
    /** Left out: calculated from the supplier's payment terms. */
    dueDate: isoDateSchema.optional(),
    type: z.enum(INVOICE_TYPES),
    isCreditNote: z.boolean().default(false),
    jobNo: identifierSchema(40).optional(),
    /** "Our ref": our own order number, the key to the hire order. */
    orderRef: identifierSchema(40).optional(),
    /** Delivery address printed on the invoice: helps recognise the site. */
    deliveryAddress: textSchema(300).optional(),
    lastInvoiceNo: identifierSchema(40).optional(),
    customerRef: textSchema(200).optional(),
    // Header totals exactly as printed. Whether they add up is checked later (R10), not here.
    net: moneySchema,
    vat: moneySchema,
    gross: moneySchema,
    lines: z.array(invoiceLineSchema).min(1, "An invoice needs at least one line").max(200),
  })
  .superRefine((invoice, ctx) => {
    const datesAreValid = [invoice.date, invoice.dueDate].every((date) => {
      try {
        if (date !== undefined) parseIsoDate(date);
        return true;
      } catch {
        return false;
      }
    });
    if (
      datesAreValid &&
      invoice.dueDate !== undefined &&
      parseIsoDate(invoice.dueDate) < parseIsoDate(invoice.date)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "The due date cannot be before the invoice date",
        path: ["dueDate"],
      });
    }
  });

export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;

export const PAYMENT_STATUSES = ["UNPAID", "PAID", "QUERIED", "CREDITED"] as const;
export const CHECK_STATUSES = ["NOT_CHECKED", "CHECKED", "QUERIED"] as const;

/** Only the statuses of an invoice can change; its contents stay exactly as printed. */
export const invoiceUpdateSchema = z
  .strictObject({
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    checkStatus: z.enum(CHECK_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;
