export type LinkProblem =
  "UNKNOWN_ORDER_REF" | "UNKNOWN_JOB_NO" | "UNKNOWN_FLEET_CODE" | "AMBIGUOUS_FLEET_CODE";

export interface OrderForLinking {
  id: string;
  supplierJobNo: string;
  items: { id: string; fleetCode: string | null }[];
}

export interface LineLink {
  orderId: string | null;
  hireItemId: string | null;
  /** Why the line could not be fully linked; null when there is nothing to report. */
  problem: LinkProblem | null;
}

/**
 * Links one invoice line to the supplier's hire orders:
 * 1. A line with a fleet code links to the item with that code: first within the order of the
 *    invoice's job number, otherwise on any order of the supplier if exactly one item matches.
 * 2. A line without a fleet code (damage waiver, transport) links to the job's order.
 * Anything that cannot be linked says why, so the user can fix the order or the line.
 */
export function linkInvoiceLine(
  line: { fleetCode?: string | null },
  invoiceJobNo: string | null | undefined,
  orders: OrderForLinking[],
): LineLink {
  const jobOrder = invoiceJobNo
    ? orders.find((order) => order.supplierJobNo === invoiceJobNo)
    : undefined;
  const jobOrderId = jobOrder?.id ?? null;

  if (!line.fleetCode) {
    if (invoiceJobNo && !jobOrder) {
      return { orderId: null, hireItemId: null, problem: "UNKNOWN_JOB_NO" };
    }
    return { orderId: jobOrderId, hireItemId: null, problem: null };
  }

  const inJob = jobOrder?.items.find((item) => item.fleetCode === line.fleetCode);
  if (jobOrder && inJob) {
    return { orderId: jobOrder.id, hireItemId: inJob.id, problem: null };
  }

  const matches = orders.flatMap((order) =>
    order.items
      .filter((item) => item.fleetCode === line.fleetCode)
      .map((item) => ({ orderId: order.id, hireItemId: item.id })),
  );
  if (matches.length === 1) {
    return { ...matches[0], problem: null };
  }
  return {
    orderId: jobOrderId,
    hireItemId: null,
    problem: matches.length === 0 ? "UNKNOWN_FLEET_CODE" : "AMBIGUOUS_FLEET_CODE",
  };
}
