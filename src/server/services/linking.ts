import { db } from "@/server/db";
import { linkInvoiceLine, type OrderForLinking } from "@/lib/invoices/link-line";
import { recognizeSite, type SiteMatch } from "@/lib/sites/recognize-site";
import { checkInvoice, recheckRelatedInvoices } from "./reconciliation";

/** The supplier's orders as the linking rules need them, with each item's earlier fleet codes. */
export async function loadOrdersForLinking(supplierId: string): Promise<OrderForLinking[]> {
  const orders = await db.hireOrder.findMany({
    where: { supplierId },
    select: {
      id: true,
      supplierJobNo: true,
      orderRef: true,
      items: {
        select: { id: true, fleetCode: true, codeChanges: { select: { oldCode: true } } },
      },
    },
  });
  return orders.map((order) => ({
    ...order,
    items: order.items.map((item) => ({
      id: item.id,
      fleetCode: item.fleetCode,
      previousFleetCodes: item.codeChanges.map((change) => change.oldCode),
    })),
  }));
}

/**
 * The site of an invoice: the site of its first linked order when it has one, otherwise the
 * site recognised from the printed customer reference and delivery address (or none).
 */
export async function resolveInvoiceSite(invoiceId: string): Promise<void> {
  const invoice = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: {
      customerRef: true,
      deliveryAddress: true,
      lines: {
        where: { orderId: { not: null } },
        orderBy: { position: "asc" },
        take: 1,
        select: { order: { select: { siteId: true } } },
      },
    },
  });

  let siteId: string | null = invoice.lines[0]?.order?.siteId ?? null;
  let siteMatchedBy: SiteMatch | "ORDER" | null = siteId ? "ORDER" : null;
  if (!siteId) {
    const sites = await db.site.findMany({ include: { aliases: true } });
    const recognised = recognizeSite(
      invoice,
      sites.map((site) => ({ ...site, aliases: site.aliases.map((a) => a.alias) })),
    );
    siteId = recognised.siteId;
    siteMatchedBy = recognised.matchedBy;
  }
  await db.invoice.update({ where: { id: invoiceId }, data: { siteId, siteMatchedBy } });
}

/**
 * Links again the invoice lines of a supplier that could not be linked, e.g. once the order
 * they belong to was entered, or an item's new fleet code recorded. Invoices whose lines
 * changed get their site resolved and their checks run again.
 */
export async function relinkInvoices(supplierId: string): Promise<void> {
  const orders = await loadOrdersForLinking(supplierId);
  const lines = await db.invoiceLine.findMany({
    where: { invoice: { supplierId }, linkProblem: { not: null } },
    include: { invoice: { select: { id: true, orderRef: true, jobNo: true } } },
  });

  const changed = new Set<string>();
  for (const line of lines) {
    const link = linkInvoiceLine(line, line.invoice, orders);
    if (
      link.orderId === line.orderId &&
      link.hireItemId === line.hireItemId &&
      link.problem === line.linkProblem
    ) {
      continue;
    }
    await db.invoiceLine.update({
      where: { id: line.id },
      data: { orderId: link.orderId, hireItemId: link.hireItemId, linkProblem: link.problem },
    });
    changed.add(line.invoice.id);
  }

  for (const invoiceId of changed) {
    await resolveInvoiceSite(invoiceId);
    await checkInvoice(invoiceId);
  }
  if (changed.size > 0) {
    const relinked = await db.invoiceLine.findMany({
      where: { invoiceId: { in: [...changed] }, orderId: { not: null } },
      select: { orderId: true },
      distinct: ["orderId"],
    });
    await recheckRelatedInvoices({ orderIds: relinked.map((line) => line.orderId as string) });
  }
}

/** Recognises again the site of invoices not tied to an order, e.g. after aliases changed. */
export async function refreshRecognisedSites(): Promise<void> {
  const invoices = await db.invoice.findMany({
    where: { OR: [{ siteMatchedBy: null }, { siteMatchedBy: { not: "ORDER" } }] },
    select: { id: true },
  });
  for (const invoice of invoices) {
    await resolveInvoiceSite(invoice.id);
  }
}
