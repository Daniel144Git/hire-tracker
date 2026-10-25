export type LinkProblem =
  "UNKNOWN_ORDER_REF" | "UNKNOWN_JOB_NO" | "UNKNOWN_FLEET_CODE" | "AMBIGUOUS_FLEET_CODE";

export interface OrderForLinking {
  id: string;
  supplierJobNo: string;
  /** Our own order number, when the invoice prints it. */
  orderRef: string | null;
  /** previousFleetCodes: codes the item had before a recorded change (E-code swaps). */
  items: { id: string; fleetCode: string | null; previousFleetCodes?: string[] }[];
}

/** What the invoice header says about the order. */
export interface InvoiceHeaderRefs {
  orderRef?: string | null;
  jobNo?: string | null;
}

export interface LineLink {
  orderId: string | null;
  hireItemId: string | null;
  /** Why the line could not be linked; null when there is nothing to report. */
  problem: LinkProblem | null;
}

/** The fleet codes an item answers to: its current code and its earlier ones. */
function codesOf(item: OrderForLinking["items"][number]): string[] {
  return [item.fleetCode, ...(item.previousFleetCodes ?? [])].filter(
    (code): code is string => code !== null,
  );
}

/**
 * Links one invoice line to the supplier's hire orders.
 * The header's order: by our order number first, then by the supplier's job number.
 * 1. A line with a fleet code links to the item with that code (current or earlier), first
 *    within the header's order, otherwise on any order if exactly one item matches.
 * 2. A line without one (damage waiver, transport) links to the header's order.
 * Anything that cannot be linked says why, so the user can fix the order or the line.
 */
export function linkInvoiceLine(
  line: { fleetCode?: string | null },
  header: InvoiceHeaderRefs,
  orders: OrderForLinking[],
): LineLink {
  const headerOrder =
    (header.orderRef && orders.find((order) => order.orderRef === header.orderRef)) ||
    (header.jobNo && orders.find((order) => order.supplierJobNo === header.jobNo)) ||
    undefined;
  const headerOrderId = headerOrder?.id ?? null;
  const headerProblem: LinkProblem | null = headerOrder
    ? null
    : header.orderRef
      ? "UNKNOWN_ORDER_REF"
      : header.jobNo
        ? "UNKNOWN_JOB_NO"
        : null;

  if (!line.fleetCode) {
    return { orderId: headerOrderId, hireItemId: null, problem: headerProblem };
  }

  const fleetCode = line.fleetCode;
  const inHeaderOrder = headerOrder?.items.find((item) => codesOf(item).includes(fleetCode));
  if (headerOrder && inHeaderOrder) {
    return { orderId: headerOrder.id, hireItemId: inHeaderOrder.id, problem: null };
  }

  const matches = orders.flatMap((order) =>
    order.items
      .filter((item) => codesOf(item).includes(fleetCode))
      .map((item) => ({ orderId: order.id, hireItemId: item.id })),
  );
  if (matches.length === 1) {
    return { ...matches[0], problem: null };
  }
  return {
    orderId: headerOrderId,
    hireItemId: null,
    problem: matches.length === 0 ? "UNKNOWN_FLEET_CODE" : "AMBIGUOUS_FLEET_CODE",
  };
}
