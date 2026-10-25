"use server";

import { refresh } from "next/cache";
import { invoiceUpdateSchema } from "@/lib/schemas/invoice";
import { updateInvoiceStatus } from "@/server/services/invoices";

/** "Mark paid", "Query", "Back to unpaid": one button per status, the same service as the API. */
export async function setPaymentStatusAction(formData: FormData): Promise<void> {
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const { paymentStatus } = invoiceUpdateSchema.parse({
    paymentStatus: formData.get("paymentStatus"),
  });
  await updateInvoiceStatus(invoiceId, { paymentStatus });
  refresh();
}
