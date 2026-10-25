import { describe, expect, it } from "vitest";
import { itemTracking } from "@/lib/reconciliation/checks/r15-item-tracking";
import { context, hireLine, invoice, order } from "./builders";

const twoItems = order({
  items: [
    { id: "item-1", description: "Scissor lift", fleetCode: "APX-SL-1042", weeklyRate: 50 },
    { id: "item-2", description: "Pipe groover", fleetCode: "APX-PG-0317", weeklyRate: 41.29 },
  ],
});
const grooverLine = (overrides = {}) =>
  hireLine({
    id: "groover",
    position: 2,
    fleetCode: "APX-PG-0317",
    hireItemId: "item-2",
    net: 173.42,
    vat: 34.68,
    ...overrides,
  });

const julyBothItems = invoice({
  id: "invoice-july",
  number: "INV-20700",
  date: "2026-07-31",
  lines: [
    hireLine({
      id: "july-lift",
      periodFrom: "2026-07-01",
      periodTo: "2026-07-31",
      net: 230,
      vat: 46,
    }),
    grooverLine({
      id: "july-groover",
      periodFrom: "2026-07-01",
      periodTo: "2026-07-31",
      net: 189.93,
      vat: 37.99,
    }),
  ],
});

describe("R15: item tracking month to month, per job", () => {
  it("flags a fleet code billed last month that is gone this month with no return invoice", () => {
    const ctx = context({ orders: [twoItems], otherInvoices: [julyBothItems] });

    expect(itemTracking(ctx)).toEqual([
      expect.objectContaining({
        check: "R15",
        severity: "MEDIUM",
        invoiceLineId: null,
        message:
          "APX-PG-0317 was billed on INV-20700 but is not on this invoice and has no return invoice: returned, lost or swapped? Confirm on site",
      }),
    ]);
  });

  it("does not flag a fleet code that left with a return invoice", () => {
    const returnInvoice = invoice({
      id: "return",
      number: "INV-R100",
      date: "2026-08-14",
      type: "RETURN",
      lines: [grooverLine({ id: "r", periodTo: "2026-08-12", net: 66.06, vat: 13.21 })],
    });

    const ctx = context({ orders: [twoItems], otherInvoices: [julyBothItems, returnInvoice] });

    expect(itemTracking(ctx)).toEqual([]);
  });

  it("does not flag a fleet code whose order was off-hired", () => {
    const offHired = { ...twoItems, offHireDate: "2026-08-12" };

    expect(itemTracking(context({ orders: [offHired], otherInvoices: [julyBothItems] }))).toEqual(
      [],
    );
  });

  it("flags a new fleet code on the job as LOW: an item swapped?", () => {
    const julyLiftOnly = invoice({ ...julyBothItems, lines: [julyBothItems.lines[0]] });
    const ctx = context({
      orders: [twoItems],
      otherInvoices: [julyLiftOnly],
      invoice: invoice({ lines: [hireLine(), grooverLine()] }),
    });

    expect(itemTracking(ctx)).toEqual([
      expect.objectContaining({
        severity: "LOW",
        invoiceLineId: "groover",
        message:
          "APX-PG-0317 is new on job J100101 since INV-20700: item swapped? Check its rate and start date. Confirm on site",
      }),
    ]);
  });

  it("has nothing to compare on the first invoice of a job", () => {
    expect(itemTracking(context({ orders: [twoItems] }))).toEqual([]);
  });

  it("does not look for missing items on a return invoice, which lists only returned items", () => {
    const ctx = context({
      orders: [twoItems],
      otherInvoices: [julyBothItems],
      invoice: invoice({ type: "RETURN" }),
    });

    expect(itemTracking(ctx)).toEqual([]);
  });

  describe("fleet code changes (E-codes)", () => {
    const swapped = order({
      items: [
        { id: "item-1", description: "Scissor lift", fleetCode: "APX-SL-1042", weeklyRate: 50 },
        {
          id: "item-2",
          description: "Pipe groover",
          fleetCode: "APX-PG-0400",
          weeklyRate: 41.29,
          previousFleetCodes: ["APX-PG-0317"],
        },
      ],
    });

    it("says nothing about a code change that was recorded on the item", () => {
      const ctx = context({
        orders: [swapped],
        otherInvoices: [julyBothItems],
        invoice: invoice({ lines: [hireLine(), grooverLine({ fleetCode: "APX-PG-0400" })] }),
      });

      expect(itemTracking(ctx)).toEqual([]);
    });

    it("reports a code gone and a code new on the job as one possible swap", () => {
      const ctx = context({
        orders: [twoItems],
        otherInvoices: [julyBothItems],
        invoice: invoice({
          lines: [
            hireLine(),
            grooverLine({
              fleetCode: "APX-PG-0400",
              hireItemId: null,
              linkProblem: "UNKNOWN_FLEET_CODE",
            }),
          ],
        }),
      });

      expect(itemTracking(ctx)).toEqual([
        expect.objectContaining({
          check: "R15",
          severity: "MEDIUM",
          invoiceLineId: "groover",
          message:
            "APX-PG-0317 (billed on INV-20700) is gone and APX-PG-0400 is new on job J100101: the same item swapped? Confirm on site, then record the new code on the item",
        }),
      ]);
    });
  });
});
