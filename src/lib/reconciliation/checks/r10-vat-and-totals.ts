import { round2 } from "@/lib/money";
import { differsBeyond, finding, money } from "../helpers";
import type { Check, Finding } from "../types";

const EXACT = 0;

/**
 * R10: VAT on each line must be round(net x VAT rate, 2), and the header totals must be the
 * sums of the lines (brief 4.3: the VAT total is the sum of the rounded line VAT, which can
 * differ by a few pence from VAT on the net total). Loss and damage charges (OTHER) may be
 * outside the scope of VAT, so 0% is accepted on them.
 */
export const vatAndTotals: Check = (context) => {
  const { invoice, vatRate } = context;
  const findings: Finding[] = [];
  const percent = `${round2(vatRate * 100)}%`;

  for (const line of invoice.lines) {
    const expectedVat = round2(line.net * vatRate);
    const zeroRatedOk = line.chargeType === "OTHER" && line.vat === 0;
    if (!zeroRatedOk && differsBeyond(line.vat, expectedVat, EXACT)) {
      findings.push(
        finding(
          "R10",
          "MEDIUM",
          line.id,
          `VAT ${money(line.vat)} on a net of ${money(line.net)}: ${percent} is ${money(expectedVat)}`,
          { billed: line.vat, expected: expectedVat, difference: line.vat - expectedVat },
        ),
      );
    }
  }

  const sum = (values: number[]) => round2(values.reduce((total, value) => total + value, 0));
  const totals: [string, number, number, string][] = [
    ["Net total", invoice.net, sum(invoice.lines.map((l) => l.net)), "the sum of the lines"],
    ["VAT total", invoice.vat, sum(invoice.lines.map((l) => l.vat)), "the sum of the lines"],
    ["Gross", invoice.gross, round2(invoice.net + invoice.vat), "net + VAT"],
  ];
  for (const [label, billed, expected, rule] of totals) {
    if (differsBeyond(billed, expected, EXACT)) {
      findings.push(
        finding(
          "R10",
          "MEDIUM",
          null,
          `${label} ${money(billed)} is not ${rule}, ${money(expected)}`,
          {
            billed,
            expected,
            difference: billed - expected,
          },
        ),
      );
    }
  }
  return findings;
};
