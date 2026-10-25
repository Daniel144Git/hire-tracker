import { describe, expect, it } from "vitest";
import { fleetCodeNotOnOrder } from "@/lib/reconciliation/checks/r08-fleet-code-not-on-order";
import { context, hireLine, invoice, order } from "./builders";

describe("R8: fleet code not on an order of this job and site", () => {
  it("flags a fleet code that is on no hire order", () => {
    const ctx = context({
      invoice: invoice({
        lines: [
          hireLine({
            fleetCode: "APX-ZZ-0000",
            hireItemId: null,
            linkProblem: "UNKNOWN_FLEET_CODE",
          }),
        ],
      }),
    });

    expect(fleetCodeNotOnOrder(ctx)).toEqual([
      expect.objectContaining({
        check: "R8",
        severity: "HIGH",
        invoiceLineId: "line-1",
        message:
          "Fleet code APX-ZZ-0000 is not on any hire order: are we paying for an item that is not on site?",
        billed: 210,
        // Nothing on our orders justifies this charge, so all of it is at stake.
        expected: 0,
        difference: 210,
      }),
    ]);
  });

  it("flags a fleet code that is on more than one hire order", () => {
    const ctx = context({
      invoice: invoice({
        lines: [hireLine({ orderId: null, hireItemId: null, linkProblem: "AMBIGUOUS_FLEET_CODE" })],
      }),
    });

    expect(fleetCodeNotOnOrder(ctx)[0]).toMatchObject({
      severity: "MEDIUM",
      message: "Fleet code APX-SL-1042 is on more than one hire order: check which one is billed",
    });
  });

  it("flags a fleet code that belongs to an order on another site", () => {
    const otherSite = order({
      id: "order-2",
      supplierJobNo: "J100102",
      site: { id: "site-2", code: "NGW" },
      items: [
        { id: "item-2", description: "Mobile platform", fleetCode: "APX-MP-0588", weeklyRate: 35 },
      ],
    });
    const ctx = context({
      orders: [order(), otherSite],
      invoice: invoice({
        lines: [hireLine({ fleetCode: "APX-MP-0588", orderId: "order-2", hireItemId: "item-2" })],
      }),
    });

    expect(fleetCodeNotOnOrder(ctx)).toEqual([
      expect.objectContaining({
        severity: "MEDIUM",
        message:
          "Fleet code APX-MP-0588 is on job J100102 at NGW, but this invoice is for job J100101 at RVS",
      }),
    ]);
  });

  it("flags once a job number that is on no hire order", () => {
    const ctx = context({
      orders: [],
      invoice: invoice({
        jobNo: "J999999",
        lines: [
          hireLine({
            orderId: null,
            hireItemId: null,
            fleetCode: null,
            linkProblem: "UNKNOWN_JOB_NO",
          }),
          hireLine({
            id: "line-2",
            orderId: null,
            hireItemId: null,
            fleetCode: null,
            linkProblem: "UNKNOWN_JOB_NO",
          }),
        ],
      }),
    });

    expect(fleetCodeNotOnOrder(ctx)).toEqual([
      expect.objectContaining({
        invoiceLineId: null,
        message: "Job number J999999 is not on any hire order",
      }),
    ]);
  });

  it("does not flag lines linked to an order of the invoice's job", () => {
    expect(fleetCodeNotOnOrder(context())).toEqual([]);
  });
});
