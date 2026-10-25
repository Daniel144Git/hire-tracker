import { round2 } from "@/lib/money";
import { amountAfter, parseAmount, parseUkDate, signed, valueAfter } from "./fields";
import type { PdfLine } from "./pdf-lines";
import type { ChargeType, DraftLine, Layout } from "./types";

const FLEET_CODE = /\(([A-Z0-9]+\/[A-Z0-9]+)(?:\s*\([A-Z]\))?\)/i;
const RATE = /£([\d,]+\.\d{2}) per week for\s*(?:(\d+) weeks?)?\s*(?:and\s+)?(?:(\d+) days?)?/i;
const PREVIOUS_INVOICE = /previous invoice no\.?\s*([A-Z0-9-]+)/i;
const ACCOUNT = /^[A-Z]{1,5}\d{1,6}$/;
const SITE_COLUMN = 3;
/** A gap of more than this many points below the last row ends the site block. */
const SITE_ROW_GAP = 20;

const hasCell = (lines: PdfLine[], pattern: RegExp) =>
  lines.some((line) => line.cells.some((cell) => pattern.test(cell.text)));

interface Block {
  dates: string[];
  value: number;
  /** The description on the block's first row. */
  first: string;
  /** All the description rows of the block, joined. */
  text: string;
}

/**
 * Layout 2, "contract": headers printed as "Label: value", where "Order No" is our own order
 * number and "Contract No." the supplier's job. A site block gives the delivery address. Each
 * item is a block of rows: dates and value on the first row, and a description that carries the
 * fleet code in brackets and the charge as "£72.00 per week for 4 weeks 3 days".
 */
export const contractLayout: Layout = {
  id: "contract",

  matches: (lines) =>
    hasCell(lines, /^(HIRE INVOICE|CREDIT NOTE)$/i) &&
    valueAfter(lines, "Contract No", "Contract") !== undefined,

  read(lines) {
    const isCreditNote = hasCell(lines, /^CREDIT NOTE$/i);
    const vatCell = lines.flatMap((line) => line.cells).find((cell) => /^VAT at /i.test(cell.text));
    const vatRate = Number(/([\d.]+)%/.exec(vatCell?.text ?? "")?.[1] ?? 20) / 100;

    const blocks = readBlocks(lines);
    const items = blocks.map((block) => toLine(block, isCreditNote, vatRate));
    const hireBlocks = blocks.filter((_, index) => items[index].chargeType === "HIRE");
    const allOffHired =
      hireBlocks.length > 0 && hireBlocks.every((block) => /off hired on/i.test(block.text));

    const amount = (label: RegExp) => {
      const value = amountAfter(lines, label);
      return value === undefined ? undefined : signed(value, isCreditNote);
    };

    return {
      accountNo: readAccount(lines),
      invoice: {
        number: valueAfter(lines, "Invoice No", "Credit Note No"),
        date: parseUkDate(valueAfter(lines, "Invoice Date") ?? ""),
        type: allOffHired ? "RETURN" : "CONTINUATION",
        isCreditNote,
        orderRef: valueAfter(lines, "Order No"),
        jobNo: valueAfter(lines, "Contract No", "Contract"),
        lastInvoiceNo: blocks.map((block) => PREVIOUS_INVOICE.exec(block.text)?.[1]).find(Boolean),
        deliveryAddress: readSite(lines),
        net: amount(/^Sub-Total$/i),
        vat: amount(/^VAT at /i),
        gross: amount(/^TOTAL$/),
        lines: items,
      },
    };
  },
};

function readBlocks(lines: PdfLine[]): Block[] {
  const head = lines.findIndex(
    (line) => hasCell([line], /^(Description|Details)$/i) && hasCell([line], /^(Value|Cost)$/i),
  );
  if (head === -1) return [];
  const blocks: Block[] = [];
  for (const line of lines.slice(head + 1)) {
    if (hasCell([line], /^(VAT No|NOTE:|Sub-Total)/i)) break;
    const dates: string[] = [];
    const texts: string[] = [];
    let value: number | undefined;
    for (const { text } of line.cells) {
      const date = parseUkDate(text);
      const amount = parseAmount(text);
      if (date) dates.push(date);
      else if (amount !== undefined) value = amount;
      else texts.push(text);
    }
    const text = texts.join(" ");
    const current = blocks.at(-1);
    if (value !== undefined) {
      blocks.push({ dates, value, first: text, text });
    } else if (current) {
      current.text = `${current.text} ${text}`.trim();
    }
  }
  return blocks;
}

function toLine(block: Block, isCreditNote: boolean, vatRate: number): DraftLine {
  const fleetCode = FLEET_CODE.exec(block.text);
  const rate = RATE.exec(block.text);
  const chargeType = chargeTypeOf(block.text, Boolean(fleetCode || rate));
  const net = signed(block.value, isCreditNote);
  const description =
    chargeType === "HIRE" && fleetCode ? block.text.slice(0, fleetCode.index).trim() : block.first;
  const line: DraftLine = { description, qty: 1, chargeType, net, vat: round2(net * vatRate) };
  if (chargeType === "TRANSPORT" && block.dates.length > 0) {
    line.periodFrom = line.periodTo = block.dates[0];
  }
  if (chargeType !== "HIRE") return line;
  if (fleetCode) line.fleetCode = fleetCode[1];
  if (block.dates.length >= 2) [line.periodFrom, line.periodTo] = block.dates;
  if (rate) {
    line.rate = Number(rate[1].replaceAll(",", ""));
    line.weeks = Number(rate[2] ?? 0);
    line.days = Number(rate[3] ?? 0);
  }
  return line;
}

function chargeTypeOf(text: string, looksLikeHire: boolean): ChargeType {
  if (/damage\/theft waiver|damage waiver/i.test(text)) return "DAMAGE_WAIVER";
  if (/\b(delivery|collection|transport|carriage)\b/i.test(text)) return "TRANSPORT";
  return looksLikeHire ? "HIRE" : "OTHER";
}

/** Our account code, printed at the start of the row with the contract number. */
function readAccount(lines: PdfLine[]): string | undefined {
  const line = lines.find((l) => hasCell([l], /^Contract\b/i));
  const first = line?.cells[0]?.text ?? "";
  return ACCOUNT.test(first) ? first : undefined;
}

/** The "Site:" block: the value beside the label and the rows under it, up to the next label. */
function readSite(lines: PdfLine[]): string | undefined {
  const index = lines.findIndex((line) => hasCell([line], /^Site:?$/i));
  if (index === -1) return undefined;
  const labelIndex = lines[index].cells.findIndex((cell) => /^Site:?$/i.test(cell.text));
  const first = lines[index].cells[labelIndex + 1];
  if (!first) return undefined;
  const inColumn = (line: PdfLine) =>
    line.cells
      .filter((cell) => cell.x >= first.x - SITE_COLUMN)
      .map((cell) => cell.text)
      .join(" ");
  const parts = [inColumn(lines[index])];
  let lastY = lines[index].y;
  for (const line of lines.slice(index + 1)) {
    if (line.cells.some((cell) => cell.text.endsWith(":")) || lastY - line.y > SITE_ROW_GAP) break;
    // Rows of our own address beside the block, printed at other heights, have nothing in it.
    const part = inColumn(line);
    if (!part) continue;
    parts.push(part);
    lastY = line.y;
  }
  return parts.join(", ");
}
