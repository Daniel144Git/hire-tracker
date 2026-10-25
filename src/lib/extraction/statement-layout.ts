import { round2 } from "@/lib/money";
import { money } from "@/lib/reconciliation/helpers";
import { parseAmount, parseUkDate, valueAfter } from "./fields";
import { groupIntoLines, type PdfCell, type PdfLine, type TextFragment } from "./pdf-lines";

/** A row of a statement: one invoice or credit note the supplier says is still open. */
export interface StatementLineDraft {
  invoiceDate: string;
  jobNo?: string;
  invoiceNo: string;
  customerRef?: string;
  /** Debit positive, credit negative. */
  amount: number;
}

export interface StatementExtraction {
  /** Our account number with the supplier: it tells which supplier sent the statement. */
  accountNo?: string;
  date?: string;
  total?: number;
  lines: StatementLineDraft[];
  warnings: string[];
}

type Column = "date" | "job" | "invoice" | "ref" | "debit" | "credit";

const HEADERS: [Column, string][] = [
  ["date", "Date"],
  ["job", "Job No."],
  ["invoice", "Invoice No."],
  ["ref", "Customer Ref"],
  ["debit", "Debit"],
  ["credit", "Credit"],
];

/** The total is printed under "Total", within this many points across and down. */
const TOTAL_NEAR_X = 40;
const TOTAL_NEAR_Y = 30;

const isHeader = (line: PdfLine) =>
  ["Job No.", "Invoice No.", "Customer Ref"].every((label) =>
    line.cells.some((cell) => cell.text === label),
  );

/**
 * Reads a supplier statement in the despatch supplier's layout: a table of the invoices still
 * open on the statement date (Date, Job No., Invoice No., Customer Ref, Debit, Credit), a copy
 * of each row on the right for the remittance (ignored), and the total under "Total".
 * Each cell is put in the column whose heading it is nearest to; a row with only a customer
 * reference continues the reference of the row above. Null when it is not a statement.
 */
export function extractStatement(fragments: TextFragment[]): StatementExtraction | null {
  const lines = groupIntoLines(fragments);
  const isStatement = lines.some((line) =>
    line.cells.some((cell) => /Statement$/i.test(cell.text)),
  );
  if (!isStatement || !lines.some(isHeader)) return null;

  const rows: StatementLineDraft[] = [];
  let columns: Map<Column, number> | undefined;
  let remittanceX = Infinity;
  for (const line of lines) {
    if (line.cells.some((cell) => /^Period Ending/i.test(cell.text))) break;
    if (isHeader(line)) {
      // Every page repeats the headings; the columns can move a little from page to page.
      columns = new Map(
        HEADERS.map(([column, label]) => [
          column,
          line.cells.find((c) => c.text === label)?.x ?? NaN,
        ]),
      );
      remittanceX = line.cells.filter((cell) => cell.text === "Date")[1]?.x ?? Infinity;
      continue;
    }
    if (!columns) continue;
    const cells = byColumn(
      line.cells.filter((cell) => cell.x < remittanceX - 5),
      columns,
    );
    const invoiceDate = parseUkDate(cells.get("date") ?? "");
    const invoiceNo = cells.get("invoice");
    if (invoiceDate && invoiceNo) {
      const debit = parseAmount(cells.get("debit") ?? "");
      const credit = parseAmount(cells.get("credit") ?? "");
      const amount = debit ?? (credit === undefined ? undefined : -Math.abs(credit));
      if (amount === undefined) continue;
      rows.push({
        invoiceDate,
        jobNo: cells.get("job"),
        invoiceNo,
        customerRef: cells.get("ref"),
        amount,
      });
    } else if (cells.size === 1 && cells.has("ref") && rows.length > 0) {
      const last = rows[rows.length - 1];
      last.customerRef = [last.customerRef, cells.get("ref")].filter(Boolean).join(" ");
    }
  }

  const accountNo = valueAfter(lines, "Account")?.split(" ")[0];
  const dateCell = lines
    .flatMap((line) => line.cells.map((cell, index) => ({ line, cell, index })))
    .find(({ cell }) => /^Date:$/i.test(cell.text));
  const date = dateCell
    ? parseUkDate(dateCell.line.cells[dateCell.index + 1]?.text ?? "")
    : undefined;
  const total = readTotal(lines);

  const warnings: string[] = [];
  if (!accountNo) warnings.push("Could not read the account number.");
  if (!date) warnings.push("Could not read the statement date.");
  if (rows.length === 0) warnings.push("Could not read any statement lines.");
  const sum = round2(rows.reduce((total, row) => total + row.amount, 0));
  if (total === undefined) warnings.push("Could not read the statement total.");
  else if (rows.length > 0 && sum !== total) {
    warnings.push(`The lines add up to ${money(sum)} but the statement total is ${money(total)}.`);
  }
  return { accountNo, date, total, lines: rows, warnings };
}

/** Puts each cell in the column whose heading starts nearest to it. */
function byColumn(cells: PdfCell[], columns: Map<Column, number>): Map<Column, string> {
  const result = new Map<Column, string>();
  for (const cell of cells) {
    let nearest: Column | undefined;
    for (const [column, x] of columns) {
      if (
        nearest === undefined ||
        Math.abs(cell.x - x) < Math.abs(cell.x - columns.get(nearest)!)
      ) {
        nearest = column;
      }
    }
    if (nearest) result.set(nearest, [result.get(nearest), cell.text].filter(Boolean).join(" "));
  }
  return result;
}

function readTotal(lines: PdfLine[]): number | undefined {
  const index = lines.findIndex((line) => line.cells.some((cell) => cell.text === "Total"));
  if (index === -1) return undefined;
  const label = lines[index].cells.find((cell) => cell.text === "Total")!;
  for (const line of lines.slice(index, index + 4)) {
    if (lines[index].y - line.y > TOTAL_NEAR_Y) break;
    for (const cell of line.cells) {
      const amount = parseAmount(cell.text);
      if (amount !== undefined && Math.abs(cell.x - label.x) <= TOTAL_NEAR_X) return amount;
    }
  }
  return undefined;
}
