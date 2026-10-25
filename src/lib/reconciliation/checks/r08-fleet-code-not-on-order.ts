import { finding, jobOrderOf, orderOf } from "../helpers";
import type { Check, Finding } from "../types";

/**
 * R8: a fleet code billed that is on no hire order (are we paying for something not on site?),
 * on more than one, or on an order of another site than the invoice's job. Also a job number
 * that matches no order.
 */
export const fleetCodeNotOnOrder: Check = (context) => {
  const { invoice } = context;
  const findings: Finding[] = [];
  const jobOrder = jobOrderOf(context);

  for (const line of invoice.lines) {
    if (line.linkProblem === "UNKNOWN_FLEET_CODE") {
      findings.push(
        finding(
          "R8",
          "HIGH",
          line.id,
          `Fleet code ${line.fleetCode} is not on any hire order: are we paying for an item that is not on site?`,
          // Nothing on our orders justifies the charge, so all of it is at stake.
          { billed: line.net, expected: 0, difference: line.net },
        ),
      );
    } else if (line.linkProblem === "AMBIGUOUS_FLEET_CODE") {
      findings.push(
        finding(
          "R8",
          "MEDIUM",
          line.id,
          `Fleet code ${line.fleetCode} is on more than one hire order: check which one is billed`,
          { billed: line.net },
        ),
      );
    } else {
      const order = orderOf(context, line);
      if (line.fleetCode && order && jobOrder && order.site.id !== jobOrder.site.id) {
        findings.push(
          finding(
            "R8",
            "MEDIUM",
            line.id,
            `Fleet code ${line.fleetCode} is on job ${order.supplierJobNo} at ${order.site.code}, but this invoice is for job ${jobOrder.supplierJobNo} at ${jobOrder.site.code}`,
            { billed: line.net },
          ),
        );
      }
    }
  }

  if (invoice.lines.some((line) => line.linkProblem === "UNKNOWN_ORDER_REF")) {
    findings.push(
      finding(
        "R8",
        "MEDIUM",
        null,
        `Our order number ${invoice.orderRef} is not on any hire order`,
      ),
    );
  }
  if (invoice.lines.some((line) => line.linkProblem === "UNKNOWN_JOB_NO")) {
    findings.push(
      finding("R8", "MEDIUM", null, `Job number ${invoice.jobNo} is not on any hire order`),
    );
  }
  return findings;
};
