import { describe, expect, it } from "vitest";
import { summarizeFindings } from "@/lib/reconciliation/report";

const f = (severity: "HIGH" | "MEDIUM" | "LOW", difference: number | null, resolved = false) => ({
  severity,
  difference,
  resolved,
});

describe("summarizeFindings: the totals of a discrepancy report", () => {
  it("counts open, high and resolved findings", () => {
    const summary = summarizeFindings([f("HIGH", 130), f("MEDIUM", 8), f("HIGH", 130, true)]);

    expect(summary).toMatchObject({ openFindings: 2, highFindings: 1, resolvedFindings: 1 });
  });

  it("adds up only the overcharges of open findings: undercharges and credited ones are left out", () => {
    const summary = summarizeFindings([
      f("HIGH", 130),
      f("MEDIUM", 0.1),
      f("LOW", -10),
      f("MEDIUM", null),
      f("HIGH", 500, true),
    ]);

    expect(summary.overcharged).toBe(130.1);
  });

  it("adds in pence, so 0.1 + 0.2 is 0.30 and not 0.30000000000000004", () => {
    expect(summarizeFindings([f("LOW", 0.1), f("LOW", 0.2)]).overcharged).toBe(0.3);
  });

  it("is all zeros for a month without findings", () => {
    expect(summarizeFindings([])).toEqual({
      openFindings: 0,
      highFindings: 0,
      resolvedFindings: 0,
      overcharged: 0,
    });
  });
});
