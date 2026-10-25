import { describe, expect, it } from "vitest";
import { runChecks } from "@/lib/reconciliation/run-checks";
import { context, hireLine, invoice, line, order } from "./builders";

describe("runChecks: runs every check and orders the findings", () => {
  it("returns no findings for a correct invoice", () => {
    const ctx = context({
      invoice: invoice({ lines: [hireLine(), line({ chargeType: "DAMAGE_WAIVER", net: 21 })] }),
    });

    expect(runChecks(ctx)).toEqual([]);
  });

  it("returns the findings of all checks, most severe first", () => {
    // Off-hired 12 Aug and billed to 31 Aug (R1, HIGH), with a VAT error (R10) and no
    // damage waiver line (R13, LOW).
    const ctx = context({
      orders: [order({ offHireDate: "2026-08-12" })],
      invoice: invoice({ lines: [hireLine({ vat: 42.5 })] }),
    });

    expect(runChecks(ctx).map((f) => [f.check, f.severity])).toEqual([
      ["R1", "HIGH"],
      ["R10", "MEDIUM"],
      ["R13", "LOW"],
    ]);
  });
});
