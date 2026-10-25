import { billedAfterOffHire } from "./checks/r01-billed-after-off-hire";
import { billedBeforeStart } from "./checks/r02-billed-before-start";
import { billedTwice } from "./checks/r03-billed-twice";
import { amountDiffersFromExpected } from "./checks/r05-amount-differs";
import { continuationAfterReturn } from "./checks/r07-continuation-after-return";
import { vatAndTotals } from "./checks/r10-vat-and-totals";
import { damageWaiverCheck } from "./checks/r13-damage-waiver";
import type { Check, Finding, ReconciliationContext } from "./types";

/** Every check the engine runs on an invoice. A new check is one file plus one line here. */
export const CHECKS: readonly Check[] = [
  billedAfterOffHire,
  billedBeforeStart,
  billedTwice,
  amountDiffersFromExpected,
  continuationAfterReturn,
  vatAndTotals,
  damageWaiverCheck,
];

const SEVERITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

/** Runs all checks on one invoice; findings are ordered most severe first, then by line. */
export function runChecks(context: ReconciliationContext): Finding[] {
  const position = new Map(context.invoice.lines.map((line) => [line.id, line.position]));
  const linePosition = (f: Finding) =>
    f.invoiceLineId === null ? Number.MAX_SAFE_INTEGER : (position.get(f.invoiceLineId) ?? 0);

  return CHECKS.flatMap((check) => check(context)).sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      linePosition(a) - linePosition(b) ||
      Number(a.check.slice(1)) - Number(b.check.slice(1)),
  );
}
