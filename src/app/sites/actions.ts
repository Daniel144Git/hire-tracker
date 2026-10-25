"use server";

import { refresh } from "next/cache";
import { readForm, toFormState, type FormState } from "@/server/form-state";
import { createSite } from "@/server/services/sites";
import { createOrder, offHireOrder, recordCollection } from "@/server/services/orders";

// Server Actions for the sites pages. Each one reads the form, calls the same service as the
// REST API (so the rules are identical in the UI and the API), and returns a FormState.
// refresh() reloads the page data so the tables show the change.

export async function createSiteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = readForm(formData, ["code", "name", "deliveryAddress"]);
  try {
    const site = await createSite(values);
    refresh();
    return { status: "success", message: `Site ${site.code} added` };
  } catch (error) {
    return toFormState(error, values);
  }
}

export async function createOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = readForm(formData, [
    "siteId",
    "supplierId",
    "supplierJobNo",
    "trade",
    "startDate",
    "description",
    "fleetCode",
    "qty",
    "weeklyRate",
  ]);
  const { description, fleetCode, qty, weeklyRate, ...order } = values;
  try {
    const created = await createOrder({
      ...order,
      items: [
        {
          description,
          fleetCode,
          qty: qty === undefined ? undefined : Number(qty),
          weeklyRate: weeklyRate === undefined ? undefined : Number(weeklyRate),
        },
      ],
    });
    refresh();
    return { status: "success", message: `Hire order ${created.supplierJobNo} added` };
  } catch (error) {
    return toFormState(error, values);
  }
}

export async function offHireAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orderId, ...values } = readForm(formData, ["orderId", "offHireDate", "collectionNo"]);
  try {
    const order = await offHireOrder(orderId ?? "", values);
    refresh();
    return { status: "success", message: `${order.supplierJobNo} off-hired` };
  } catch (error) {
    return toFormState(error, values);
  }
}

export async function recordCollectionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { orderId, ...values } = readForm(formData, ["orderId", "collectionNo"]);
  try {
    const order = await recordCollection(orderId ?? "", values);
    refresh();
    return { status: "success", message: `${order.supplierJobNo} collected` };
  } catch (error) {
    return toFormState(error, values);
  }
}
