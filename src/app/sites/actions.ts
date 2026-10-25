"use server";

import { refresh } from "next/cache";
import { readForm, toFormState, type FormState } from "@/server/form-state";
import { createSite } from "@/server/services/sites";
import {
  changeFleetCode,
  createOrder,
  offHireOrder,
  recordCollection,
} from "@/server/services/orders";
import { setSiteAliases } from "@/server/services/sites";
import { createServiceEvent } from "@/server/services/service-events";
import { createSuspension } from "@/server/services/suspensions";

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
    "orderRef",
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

export async function createSuspensionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { siteId, freeDays, ...values } = readForm(formData, [
    "siteId",
    "periodFrom",
    "periodTo",
    "freeDays",
    "note",
  ]);
  try {
    await createSuspension(siteId ?? "", {
      ...values,
      freeDays: freeDays === undefined ? undefined : Number(freeDays),
    });
    refresh();
    return {
      status: "success",
      message: "Suspension recorded: the site's invoices were re-checked",
    };
  } catch (error) {
    return toFormState(error, { ...values, ...(freeDays ? { freeDays } : {}) });
  }
}

export async function setAliasesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const siteId = String(formData.get("siteId") ?? "");
  const text = String(formData.get("aliases") ?? "");
  const aliases = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  try {
    const site = await setSiteAliases(siteId, { aliases });
    refresh();
    const count = site.aliases.length;
    return {
      status: "success",
      message: `Saved ${count} ${count === 1 ? "spelling" : "spellings"} for ${site.code}`,
    };
  } catch (error) {
    return toFormState(error, { aliases: text });
  }
}

export async function changeFleetCodeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { item, ...values } = readForm(formData, ["item", "newCode", "changedOn", "note"]);
  // The select's value is "orderId/itemId".
  const [orderId = "", itemId = ""] = (item ?? "").split("/");
  try {
    const changed = await changeFleetCode(orderId, itemId, values);
    refresh();
    return { status: "success", message: `${changed.description} is now ${changed.fleetCode}` };
  } catch (error) {
    return toFormState(error, { item: item ?? "", ...values });
  }
}

export async function createServiceEventAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { siteId, ...values } = readForm(formData, [
    "siteId",
    "date",
    "kind",
    "fleetCode",
    "description",
    "confirmedBy",
  ]);
  try {
    await createServiceEvent(siteId ?? "", values);
    refresh();
    return { status: "success", message: "Event recorded: the site's invoices were re-checked" };
  } catch (error) {
    return toFormState(error, values);
  }
}
