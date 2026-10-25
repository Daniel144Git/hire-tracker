import { round2 } from "@/lib/money";
import { differsBeyond, finding, money } from "../helpers";
import type { Check, Finding } from "../types";

const EXACT = 0;

/**
 * R10: VAT on each line must be round(net x VAT rate, 2), and the header totals must add up.
 * The VAT total may be rounded per line (the sum of the lines' VAT) or once on the net total
 * (brief 4.3): both are allowed, they can differ by a few pence, and real supplier invoices use
 * the second. Loss and damage charges (OTHER) may be outside the scope of VAT, so 0% is
 * accepted on them and they are left out of the net that VAT is taken on.
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
  const isOutOfScope = (line: (typeof invoice.lines)[number]) =>
    line.chargeType === "OTHER" && line.vat === 0;
  const vatOfLines = sum(invoice.lines.map((l) => l.vat));
  const vatOnTotal = round2(
    sum(invoice.lines.filter((l) => !isOutOfScope(l)).map((l) => l.net)) * vatRate,
  );
  if (invoice.vat !== vatOfLines && invoice.vat !== vatOnTotal) {
    findings.push(
      finding(
        "R10",
        "MEDIUM",
        null,
        `VAT total ${money(invoice.vat)} is neither the sum of the lines, ${money(vatOfLines)}, nor ${percent} of the net total, ${money(vatOnTotal)}`,
        { billed: invoice.vat, expected: vatOfLines, difference: round2(invoice.vat - vatOfLines) },
      ),
    );
  }

  const totals: [string, number, number, string][] = [
    ["Net total", invoice.net, sum(invoice.lines.map((l) => l.net)), "the sum of the lines"],
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
