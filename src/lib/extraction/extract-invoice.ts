import { round2 } from "@/lib/money";
import { contractLayout } from "./contract-layout";
import { despatchLayout } from "./despatch-layout";
import { groupIntoLines, type TextFragment } from "./pdf-lines";
import type { Extraction, InvoiceDraft, Layout } from "./types";

const LAYOUTS: Layout[] = [despatchLayout, contractLayout];

const REQUIRED: [keyof InvoiceDraft, string][] = [
  ["number", "invoice number"],
  ["date", "invoice date"],
  ["type", "invoice type"],
  ["net", "net total"],
  ["vat", "VAT total"],
  ["gross", "gross total"],
];

const pounds = (value: number) => `${value < 0 ? "-" : ""}£${Math.abs(value).toFixed(2)}`;
const sum = (values: number[]) => round2(values.reduce((total, value) => total + value, 0));

/**
 * Reads an invoice from the text of a PDF. Null when the document is in none of the known
 * layouts. Nothing here guesses: a field that cannot be read is left out with a warning, and
 * the person checking the invoice fills it in.
 */
export function extractInvoice(fragments: TextFragment[]): Extraction | null {
  const lines = groupIntoLines(fragments);
  const layout = LAYOUTS.find((candidate) => candidate.matches(lines));
  if (!layout) return null;
  const { accountNo, invoice } = layout.read(lines);
  return { layout: layout.id, accountNo, invoice, warnings: warningsFor(invoice) };
}

function warningsFor(invoice: InvoiceDraft): string[] {
  const warnings = REQUIRED.filter(([field]) => invoice[field] === undefined).map(
    ([, label]) => `Could not read the ${label}.`,
  );
  if (invoice.lines.length === 0) return [...warnings, "Could not read any invoice lines."];

  const net = sum(invoice.lines.map((line) => line.net));
  if (invoice.net !== undefined && net !== invoice.net) {
    warnings.push(
      `The lines add up to ${pounds(net)} but the net total printed is ${pounds(invoice.net)}: check the lines.`,
    );
  }
  // VAT rounded once on the total instead of per line can differ by up to half a penny a line.
  const vat = sum(invoice.lines.map((line) => line.vat));
  const rounding = invoice.lines.length * 0.005;
  if (invoice.vat !== undefined && Math.abs(vat - invoice.vat) > rounding + 1e-9) {
    warnings.push(
      `The VAT on the lines adds up to ${pounds(vat)} but the VAT printed is ${pounds(invoice.vat)}: check the VAT.`,
    );
  }
  return warnings;
}
