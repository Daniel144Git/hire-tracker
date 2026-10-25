import { billedAfterOffHire } from "./checks/r01-billed-after-off-hire";
import { billedBeforeStart } from "./checks/r02-billed-before-start";
import { billedTwice } from "./checks/r03-billed-twice";
import { amountDiffersFromExpected } from "./checks/r05-amount-differs";
import { rateDrift } from "./checks/r06-rate-drift";
import { continuationAfterReturn } from "./checks/r07-continuation-after-return";
import { fleetCodeNotOnOrder } from "./checks/r08-fleet-code-not-on-order";
import { chargeWithoutEvent } from "./checks/r09-charge-without-event";
import { vatAndTotals } from "./checks/r10-vat-and-totals";
import { rateInconsistency } from "./checks/r12-rate-inconsistency";
import { damageWaiverCheck } from "./checks/r13-damage-waiver";
import { brokenContinuationChain } from "./checks/r14-broken-chain";
import { itemTracking } from "./checks/r15-item-tracking";
import { suspensionCredit } from "./checks/r16-suspension-credit";
import { transportChargedTwice } from "./checks/r17-transport-twice";
import type { Check, Finding, ReconciliationContext } from "./types";

/**
 * Every check the engine runs on an invoice. A new check is one file plus one line here.
 * R4 (missing months) works on orders, not on one invoice: see missing-periods.ts.
 * R11 (supplier statements) works on a statement: see src/lib/statements/reconcile.ts.
 */
export const CHECKS: readonly Check[] = [
  billedAfterOffHire,
  billedBeforeStart,
  billedTwice,
  amountDiffersFromExpected,
  rateDrift,
  continuationAfterReturn,
  fleetCodeNotOnOrder,
  chargeWithoutEvent,
  vatAndTotals,
  rateInconsistency,
  damageWaiverCheck,
  brokenContinuationChain,
  itemTracking,
  suspensionCredit,
  transportChargedTwice,
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
