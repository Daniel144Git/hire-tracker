import { expectedDamageWaiver } from "@/lib/charging/damage-waiver";
import { round2 } from "@/lib/money";
import { differsBeyond, finding, money, orderOf } from "../helpers";
import type { Check } from "../types";

/**
 * R13: the damage waiver on an invoice must be the supplier's % of the hire lines whose order
 * carries damage waiver. Reports a wrong amount (saying so when it matches hire + transport),
 * a waiver charged when no order carries one, and a missing waiver (LOW).
 */
export const damageWaiverCheck: Check = (context) => {
  const { invoice, rules, tolerance } = context;
  const pct = rules.damageWaiverPct;
  const waiverLines = invoice.lines.filter((line) => line.chargeType === "DAMAGE_WAIVER");
  const billed = round2(waiverLines.reduce((sum, line) => sum + line.net, 0));

  const hireLines = invoice.lines.filter((line) => line.chargeType === "HIRE");
  const waiverable = invoice.lines.map((line) => ({
    chargeType: line.chargeType,
    net: line.net,
    // A line not linked to an order follows the supplier's default: damage waiver applies.
    damageWaiverApplies: orderOf(context, line)?.damageWaiverApplies ?? true,
  }));
  const expected = expectedDamageWaiver(waiverable, pct);
  const applicableHire = round2(
    waiverable
      .filter((line) => line.chargeType === "HIRE" && line.damageWaiverApplies)
      .reduce((sum, line) => sum + line.net, 0),
  );

  if (waiverLines.length === 0) {
    if (expected === 0) return [];
    return [
      finding("R13", "LOW", null, `No damage waiver line, expected ${money(expected)}`, {
        billed: 0,
        expected,
        difference: -expected,
      }),
    ];
  }

  const lineId = waiverLines[0].id;
  if (expected === 0 && hireLines.length > 0 && billed !== 0) {
    return [
      finding(
        "R13",
        "MEDIUM",
        lineId,
        `Damage waiver ${money(billed)} charged, but no order on this invoice carries damage waiver`,
        { billed, expected: 0, difference: billed },
      ),
    ];
  }
  if (!differsBeyond(billed, expected, tolerance)) return [];

  const transport = invoice.lines
    .filter((line) => line.chargeType === "TRANSPORT")
    .reduce((sum, line) => sum + line.net, 0);
  const withTransport = round2(((applicableHire + transport) * pct) / 100);
  const message =
    transport !== 0 && !differsBeyond(billed, withTransport, tolerance)
      ? `Damage waiver ${money(billed)} includes transport: ${pct}% of the hire charges of ${money(applicableHire)} is ${money(expected)}`
      : `Damage waiver ${money(billed)}, expected ${money(expected)}: ${pct}% of the hire charges of ${money(applicableHire)}`;

  return [
    finding("R13", "MEDIUM", lineId, message, { billed, expected, difference: billed - expected }),
  ];
};
