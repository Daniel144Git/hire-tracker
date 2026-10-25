import { z } from "zod";
import { db } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { fromPence, toPence } from "@/lib/money";
import { planCollection, planOffHire } from "@/lib/orders/status";
import {
  collectionSchema,
  hireItemSchema,
  offHireSchema,
  orderCreateSchema,
  orderUpdateSchema,
  type HireItemInput,
} from "@/lib/schemas/order";
import type { HireItem, Prisma } from "@/generated/prisma/client";
import { recheckRelatedInvoices } from "./reconciliation";

const ORDER_STATUSES = ["ON_HIRE", "OFF_HIRED", "COLLECTED"] as const;

export const orderFilterSchema = z.strictObject({
  siteId: z.string().min(1).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
});

const orderInclude = {
  supplier: { select: { id: true, name: true } },
  site: { select: { id: true, code: true, name: true } },
  items: { orderBy: [{ isAccessory: "asc" }, { createdAt: "asc" }] },
} satisfies Prisma.HireOrderInclude;

type OrderRow = Prisma.HireOrderGetPayload<{ include: typeof orderInclude }>;

export type OrderDto = ReturnType<typeof toDto>;
export type HireItemDto = OrderDto["items"][number];

function itemToDto(item: HireItem) {
  return {
    id: item.id,
    description: item.description,
    fleetCode: item.fleetCode,
    qty: item.qty,
    weeklyRate: fromPence(item.weeklyRatePence),
    despatchNo: item.despatchNo,
    despatchDate: item.despatchDate,
    isAccessory: item.isAccessory,
  };
}

function toDto(order: OrderRow) {
  return {
    id: order.id,
    supplierJobNo: order.supplierJobNo,
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

  const order = await db.hireOrder.create({
    data: {
      ...input,
      damageWaiverApplies: input.damageWaiverApplies ?? supplier.damageWaiverPct > 0,
      items: { create: items.map(toItemData) },
    },
    include: orderInclude,
  });
  return toDto(order);
}

export async function updateOrder(id: string, body: unknown): Promise<OrderDto> {
  const input = orderUpdateSchema.parse(body);
  await getOrder(id);
  return toDto(await db.hireOrder.update({ where: { id }, data: input, include: orderInclude }));
}

export async function addItem(orderId: string, body: unknown): Promise<HireItemDto> {
  const input = hireItemSchema.parse(body);
  await getOrder(orderId);
  return itemToDto(await db.hireItem.create({ data: { ...toItemData(input), orderId } }));
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
