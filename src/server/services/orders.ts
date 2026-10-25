import { z } from "zod";
import { db } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { fromPence, toPence } from "@/lib/money";
import { planCollection, planOffHire } from "@/lib/orders/status";
import {
  collectionSchema,
  fleetCodeChangeSchema,
  hireItemSchema,
  offHireSchema,
  orderCreateSchema,
  orderUpdateSchema,
  type HireItemInput,
} from "@/lib/schemas/order";
import type { FleetCodeChange, HireItem, Prisma } from "@/generated/prisma/client";
import { relinkInvoices } from "./linking";
import { recheckRelatedInvoices } from "./reconciliation";

const ORDER_STATUSES = ["ON_HIRE", "OFF_HIRED", "COLLECTED"] as const;

export const orderFilterSchema = z.strictObject({
  siteId: z.string().min(1).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
});

const orderInclude = {
  supplier: { select: { id: true, name: true } },
  site: { select: { id: true, code: true, name: true } },
  items: {
    orderBy: [{ isAccessory: "asc" }, { createdAt: "asc" }],
    include: { codeChanges: { orderBy: { createdAt: "asc" } } },
  },
} satisfies Prisma.HireOrderInclude;

type OrderRow = Prisma.HireOrderGetPayload<{ include: typeof orderInclude }>;

export type OrderDto = ReturnType<typeof toDto>;
export type HireItemDto = OrderDto["items"][number];

type ItemRow = HireItem & { codeChanges: FleetCodeChange[] };

function itemToDto(item: ItemRow) {
  return {
    id: item.id,
    description: item.description,
    fleetCode: item.fleetCode,
    qty: item.qty,
    weeklyRate: fromPence(item.weeklyRatePence),
    despatchNo: item.despatchNo,
    despatchDate: item.despatchDate,
    isAccessory: item.isAccessory,
    /** Earlier fleet codes (E-codes) of the item, oldest first. */
    fleetCodeHistory: item.codeChanges.map((change) => ({
      oldCode: change.oldCode,
      newCode: change.newCode,
      changedOn: change.changedOn,
      note: change.note,
    })),
  };
}

function toDto(order: OrderRow) {
  return {
    id: order.id,
    supplierJobNo: order.supplierJobNo,
    orderRef: order.orderRef,
    supplier: order.supplier,
    site: order.site,
    trade: order.trade,
    startDate: order.startDate,
    offHireDate: order.offHireDate,
    collectionNo: order.collectionNo,
    damageWaiverApplies: order.damageWaiverApplies,
    status: order.status,
    items: order.items.map(itemToDto),
  };
}

function toItemData({ weeklyRate, ...item }: HireItemInput) {
  return { ...item, weeklyRatePence: toPence(weeklyRate) };
}

export async function listOrders(filters: unknown = {}): Promise<OrderDto[]> {
  const { siteId, status } = orderFilterSchema.parse(filters);
  const orders = await db.hireOrder.findMany({
    where: { siteId, status },
    include: orderInclude,
    orderBy: [{ startDate: "desc" }, { supplierJobNo: "asc" }],
  });
  return orders.map(toDto);
}

export async function getOrder(id: string): Promise<OrderDto> {
  const order = await db.hireOrder.findUnique({ where: { id }, include: orderInclude });
  if (!order) throw new NotFoundError("Hire order", id);
  return toDto(order);
}

export async function createOrder(body: unknown): Promise<OrderDto> {
  const { items, ...input } = orderCreateSchema.parse(body);

  const [supplier, site] = await Promise.all([
    db.supplier.findUnique({ where: { id: input.supplierId } }),
    db.site.findUnique({ where: { id: input.siteId } }),
  ]);
  const issues = [
    ...(supplier ? [] : [{ path: ["supplierId"], message: "Supplier not found" }]),
    ...(site ? [] : [{ path: ["siteId"], message: "Site not found" }]),
  ];
  if (!supplier || !site) throw new ValidationError("The request is not valid", issues);

  const duplicate = await db.hireOrder.findUnique({
    where: {
      supplierId_supplierJobNo: { supplierId: supplier.id, supplierJobNo: input.supplierJobNo },
    },
  });
  if (duplicate) {
    throw new ConflictError(
      `Job number ${input.supplierJobNo} already exists for ${supplier.name}`,
      "DUPLICATE_JOB_NO",
    );
  }

  if (input.orderRef) await assertOrderRefIsFree(input.orderRef);

  const order = await db.hireOrder.create({
    data: {
      ...input,
      damageWaiverApplies: input.damageWaiverApplies ?? supplier.damageWaiverPct > 0,
      items: { create: items.map(toItemData) },
    },
  });
  // Invoices may have arrived before the order was entered: link them now.
  await relinkInvoices(supplier.id);
  return getOrder(order.id);
}

async function assertOrderRefIsFree(orderRef: string, exceptId?: string): Promise<void> {
  const existing = await db.hireOrder.findUnique({ where: { orderRef } });
  if (existing && existing.id !== exceptId) {
    throw new ConflictError(`Order number ${orderRef} is already used`, "DUPLICATE_ORDER_REF");
  }
}

export async function updateOrder(id: string, body: unknown): Promise<OrderDto> {
  const input = orderUpdateSchema.parse(body);
  const order = await getOrder(id);
  if (input.orderRef) await assertOrderRefIsFree(input.orderRef, id);
  await db.hireOrder.update({ where: { id }, data: input });
  if (input.orderRef) await relinkInvoices(order.supplier.id);
  return getOrder(id);
}

export async function addItem(orderId: string, body: unknown): Promise<HireItemDto> {
  const input = hireItemSchema.parse(body);
  const order = await getOrder(orderId);
  const item = await db.hireItem.create({
    data: { ...toItemData(input), orderId },
    include: { codeChanges: true },
  });
  await relinkInvoices(order.supplier.id);
  return itemToDto(item);
}

/**
 * Records a new fleet code (E-code) for an item, e.g. when the supplier swaps it. The old code
 * is kept in the item's history, so lines billed with it still link to the item; lines billed
 * with the new code are linked now, and the order's invoices are checked again.
 */
export async function changeFleetCode(
  orderId: string,
  itemId: string,
  body: unknown,
): Promise<HireItemDto> {
  const input = fleetCodeChangeSchema.parse(body);
  const order = await getOrder(orderId);
  const item = order.items.find((i) => i.id === itemId);
  if (!item) throw new NotFoundError("Item", itemId);
  if (item.fleetCode === input.newCode) {
    throw new ValidationError("The request is not valid", [
      { path: ["newCode"], message: `The item already has fleet code ${input.newCode}` },
    ]);
  }

  await db.$transaction([
    ...(item.fleetCode
      ? [
          db.fleetCodeChange.create({
            data: {
              hireItemId: itemId,
              oldCode: item.fleetCode,
              newCode: input.newCode,
              changedOn: input.changedOn,
              note: input.note,
            },
          }),
        ]
      : []),
    db.hireItem.update({ where: { id: itemId }, data: { fleetCode: input.newCode } }),
  ]);
  await relinkInvoices(order.supplier.id);
  await recheckRelatedInvoices({ orderIds: [orderId] });
  const updated = (await getOrder(orderId)).items.find((i) => i.id === itemId);
  return updated as HireItemDto;
}

export async function offHireOrder(id: string, body: unknown): Promise<OrderDto> {
  const input = offHireSchema.parse(body);
  const order = await getOrder(id);
  const change = planOffHire(order, input);
  const updated = await db.hireOrder.update({
    where: { id },
    data: { ...change, offHireEnteredAt: new Date() },
    include: orderInclude,
  });
  // R1 compares every invoice of this order with the off-hire date just entered.
  await recheckRelatedInvoices({ orderIds: [id] });
  return toDto(updated);
}

export async function recordCollection(id: string, body: unknown): Promise<OrderDto> {
  const input = collectionSchema.parse(body);
  const order = await getOrder(id);
  const change = planCollection(order, input);
  return toDto(await db.hireOrder.update({ where: { id }, data: change, include: orderInclude }));
}
