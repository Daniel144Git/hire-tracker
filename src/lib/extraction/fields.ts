import { formatIsoDate } from "@/lib/charging/iso-date";
import type { PdfLine } from "./pdf-lines";

/**
 * A UK date as printed, "31/08/2026" or "31/08/26", as YYYY-MM-DD. A leading ": " is ignored.
 * Undefined when it is not a real date.
 */
export function parseUkDate(text: string): string | undefined {
  const match = /^:?\s*(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(text.trim());
  if (!match) return undefined;
  const [, day, month, year] = match.map(Number);
  const fullYear = year < 100 ? 2000 + year : year;
  const time = Date.UTC(fullYear, month - 1, day);
  const date = new Date(time);
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return formatIsoDate(time);
}

/**
 * An amount as printed: "£1,234.56", "504.00", or negative as "-£5.00" or "1.50-".
 * Undefined unless it has exactly two decimals, so "4 wks" or a year is never read as money.
 */
export function parseAmount(text: string): number | undefined {
  const match = /^(-?)£?(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})(-?)$/.exec(text.trim());
  if (!match) return undefined;
  const [, leadingMinus, pounds, pence, trailingMinus] = match;
  const value = Number(`${pounds.replaceAll(",", "")}.${pence}`);
  return leadingMinus || trailingMinus ? -value : value;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The value printed after a label: in the same cell ("Invoice No: L1", "Contract:L2") or in the
 * next one ("Invoice No" then ": 123"). The first label found wins; labels are tried in order.
 */
export function valueAfter(lines: PdfLine[], ...labels: string[]): string | undefined {
  for (const label of labels) {
    const pattern = new RegExp(`^${escape(label)}\\.?\\s*:?\\s*(.*)$`, "i");
    for (const line of lines) {
      for (const [index, cell] of line.cells.entries()) {
        const match = pattern.exec(cell.text);
        if (!match) continue;
        const value = (match[1] || line.cells[index + 1]?.text || "").replace(/^:\s*/, "").trim();
        if (value) return value;
      }
    }
  }
  return undefined;
}

/** The amount in the cell after a label, e.g. "GOODS" then "554.40": the last one on the page. */
export function amountAfter(lines: PdfLine[], label: RegExp): number | undefined {
  let found: number | undefined;
  for (const line of lines) {
    for (const [index, cell] of line.cells.entries()) {
      const amount = label.test(cell.text)
        ? parseAmount(line.cells[index + 1]?.text ?? "")
        : undefined;
      if (amount !== undefined) found = amount;
    }
  }
  return found;
}

/** An amount as printed on an invoice; every amount on a credit note is a credit. */
export function signed(amount: number, isCreditNote: boolean): number {
  return isCreditNote ? -Math.abs(amount) : amount;
}
