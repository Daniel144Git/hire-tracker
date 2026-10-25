import { fromPence, toPence } from "@/lib/money";

interface SummarisableFinding {
  severity: "HIGH" | "MEDIUM" | "LOW";
  difference: number | null;
  resolved: boolean;
}

/**
 * Totals of a discrepancy report. `overcharged` is the money to query or claim back: the sum
 * of the positive differences of the open findings, added in whole pence.
 */
export function summarizeFindings(findings: SummarisableFinding[]) {
  const open = findings.filter((finding) => !finding.resolved);
  const overchargedPence = open.reduce(
    (sum, finding) => sum + Math.max(toPence(finding.difference ?? 0), 0),
    0,
  );
  return {
    openFindings: open.length,
    highFindings: open.filter((finding) => finding.severity === "HIGH").length,
    resolvedFindings: findings.length - open.length,
    overcharged: fromPence(overchargedPence),
  };
}
