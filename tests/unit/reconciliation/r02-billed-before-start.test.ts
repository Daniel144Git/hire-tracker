import { describe, expect, it } from "vitest";
import { billedBeforeStart } from "@/lib/reconciliation/checks/r02-billed-before-start";
import { context, hireLine, invoice, order } from "./builders";

describe("R2: billed before the start of hire", () => {
  it("flags the working days billed before a delivery on Thu 13 Aug", () => {
    const findings = billedBeforeStart(context({ orders: [order({ startDate: "2026-08-13" })] }));

    expect(findings).toEqual([
      expect.objectContaining({
        check: "R2",
        severity: "HIGH",
        invoiceLineId: "line-1",
        message:
          "Job J100101 started on 2026-08-13 but was billed from 2026-08-01: 8 working days charged before the start of hire",
        billed: 210,
        expected: 130,
        difference: 80,
      }),
    ]);
  });

  it("does not flag a period that starts on the start date", () => {
    const ctx = context({
      orders: [order({ startDate: "2026-08-13" })],
      invoice: invoice({ lines: [hireLine({ periodFrom: "2026-08-13", net: 130, vat: 26 })] }),
    });

    expect(billedBeforeStart(ctx)).toEqual([]);
  });

  it("does not flag a period that starts on the weekend before a Monday delivery", () => {
    expect(billedBeforeStart(context({ orders: [order({ startDate: "2026-08-03" })] }))).toEqual(
      [],
    );
  });

  it("ignores credit lines", () => {
    const ctx = context({
      orders: [order({ startDate: "2026-08-13" })],
      invoice: invoice({ lines: [hireLine({ net: -210, vat: -42 })] }),
    });

    expect(billedBeforeStart(ctx)).toEqual([]);
  });
});
