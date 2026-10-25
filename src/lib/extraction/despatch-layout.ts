import { round2 } from "@/lib/money";
import { amountAfter, parseAmount, parseUkDate, signed, valueAfter } from "./fields";
import type { PdfLine } from "./pdf-lines";
import type { ChargeType, DraftLine, InvoiceType, Layout } from "./types";

const TYPES: Record<string, InvoiceType> = {
  CONTINUATION: "CONTINUATION",
  RETURN: "RETURN",
  SALE: "SALE",
  // A workshop invoice charges for damage or parts after an item came back.
  WORKSHOP: "SALE",
};

const ITEM = /^(\d+)\s*x\s+(.+)$/i;
const DURATION = /^(?:(\d+) wks?)?\s*(?:(\d+) days?)?$/i;
const FLEET_CODE = /^Ecode:\s*(\S+)$/i;
const ADDRESS_COLUMN = 3;

const hasCell = (lines: PdfLine[], pattern: RegExp) =>
  lines.some((line) => line.cells.some((cell) => pattern.test(cell.text)));

/**
 * Layout 1, "despatch": header fields printed as "Label : value", where "Our Ref" is the
 * supplier's job number and "Your Ref" our reference for the site. Lines are grouped under
 * despatch notes; each item row reads "N x Item  from  to  W wks D days  rate  / week  total
 * VAT code", with the fleet code on the row below ("Ecode: ..."). A VAT summary gives the rate
 * of each VAT code, and GOODS / VAT / TOTAL the totals.
 */
export const despatchLayout: Layout = {
  id: "despatch",

  matches: (lines) => hasCell(lines, /^Qty\/Item$/i) && hasCell(lines, /^Our Ref$/i),

  read(lines) {
    const isCreditNote = hasCell(lines, /^Credit No$/i);
    const typeText = valueAfter(lines, "Type")?.toUpperCase();
    const isWorkshop = typeText === "WORKSHOP";

    const start = lines.findIndex((line) => line.cells[0]?.text === "Qty/Item");
    const summary = lines.findIndex(
      (line, index) =>
        index > start && line.cells[0]?.text === "VAT" && line.cells[1]?.text === "Description",
    );
    const body = lines.slice(start + 1, summary === -1 ? undefined : summary);
    const vatRates = readVatRates(summary === -1 ? [] : lines.slice(summary + 1));

    // A sub-line (e.g. a suspension credit) belongs to the item above it: same charge type,
    // same fleet code (so it links to the same item) and same VAT rate.
    const items: { line: DraftLine; parent?: DraftLine }[] = [];
    let item: { line: DraftLine; vatRate: number } | undefined;
    for (const line of body) {
      const first = line.cells[0]?.text ?? "";
      const fleetCode = FLEET_CODE.exec(first);
      const itemRow = ITEM.exec(first);
      if (fleetCode && item) {
        item.line.fleetCode = fleetCode[1];
      } else if (itemRow) {
        const vatRate = (vatRates.get(line.cells.at(-1)?.text ?? "") ?? 20) / 100;
        const read = readItem(
          line,
          Number(itemRow[1]),
          itemRow[2],
          isWorkshop,
          isCreditNote,
          vatRate,
        );
        item = read && { line: read, vatRate };
        if (item) items.push({ line: item.line });
      } else if (item) {
        const subLine = readSubLine(line, item.line, isCreditNote, item.vatRate);
        if (subLine) items.push({ line: subLine, parent: item.line });
      }
    }

    const amount = (label: RegExp) => {
      const value = amountAfter(lines, label);
      return value === undefined ? undefined : signed(value, isCreditNote);
    };

    return {
      accountNo: valueAfter(lines, "Account"),
      invoice: {
        number: valueAfter(lines, "Invoice No", "Credit No"),
        date: parseUkDate(valueAfter(lines, "Invoice Date", "Credit Date") ?? ""),
        dueDate: parseUkDate(valueAfter(lines, "Due Date") ?? ""),
        type: typeText ? TYPES[typeText] : undefined,
        isCreditNote,
        jobNo: valueAfter(lines, "Our Ref"),
        customerRef: valueAfter(lines, "Your Ref"),
        lastInvoiceNo: valueAfter(lines, "Last Invoice"),
        deliveryAddress: readDeliveryAddress(body),
        net: amount(/^GOODS$/),
        vat: amount(/^VAT$/),
        gross: amount(/^TOTAL$/),
        lines: items.map(({ line, parent }) =>
          parent?.fleetCode ? { ...line, fleetCode: parent.fleetCode } : line,
        ),
      },
    };
  },
};

function readItem(
  line: PdfLine,
  qty: number,
  description: string,
  isWorkshop: boolean,
  isCreditNote: boolean,
  vatRate: number,
): DraftLine | undefined {
  const rest = line.cells.slice(1).map((cell) => cell.text);
  const amounts = rest.map(parseAmount).filter((value) => value !== undefined);
  const total = amounts.at(-1);
  if (total === undefined) return undefined;
  const dates = rest.map(parseUkDate).filter((value) => value !== undefined);
  const unit = rest.find((text) => text.startsWith("/")) ?? "";
  const duration = rest.map((text) => DURATION.exec(text)).find((match) => match?.[0]);

  const chargeType = chargeTypeOf(description, unit, isWorkshop);
  const net = signed(total, isCreditNote);
  const result: DraftLine = { description, qty, chargeType, net, vat: round2(net * vatRate) };
  if (chargeType === "TRANSPORT" && dates.length > 0) {
    // The day of the trip: two trips on different days are different charges (R17).
    result.periodFrom = result.periodTo = dates[0];
  }
  if (chargeType === "HIRE") {
    if (dates.length >= 2) [result.periodFrom, result.periodTo] = dates;
    if (duration) {
      result.weeks = Number(duration[1] ?? 0);
      result.days = Number(duration[2] ?? 0);
    }
    if (amounts.length >= 2) result.rate = Math.abs(amounts[0]);
  }
  return result;
}

/** A row under an item that is not an item itself but carries an amount: "Free days ... 121.28-". */
function readSubLine(
  line: PdfLine,
  item: DraftLine,
  isCreditNote: boolean,
  vatRate: number,
): DraftLine | undefined {
  const amount = parseAmount(line.cells.at(-1)?.text ?? "");
  if (amount === undefined || line.cells.length < 2) return undefined;
  const description = line.cells
    .slice(0, -1)
    .map((cell) => cell.text)
    .join(" ");
  const net = signed(amount, isCreditNote);
  return { description, qty: 1, chargeType: item.chargeType, net, vat: round2(net * vatRate) };
}

function chargeTypeOf(description: string, unit: string, isWorkshop: boolean): ChargeType {
  if (/damage waiver/i.test(description)) return "DAMAGE_WAIVER";
  if (/transport|delivery|collection|carriage/i.test(description)) return "TRANSPORT";
  if (/week/i.test(unit)) return "HIRE";
  if (isWorkshop) return "OTHER";
  if (/each/i.test(unit)) return "SALE";
  return "OTHER";
}

/** "S  Standard  554.40  20.00  110.88": the VAT code and its rate in percent. */
function readVatRates(lines: PdfLine[]): Map<string, number> {
  const rates = new Map<string, number>();
  for (const { cells } of lines) {
    const code = cells[0]?.text ?? "";
    const [, rate] = cells.slice(2).map((cell) => parseAmount(cell.text));
    if (/^[A-Z]$/.test(code) && rate !== undefined) rates.set(code, rate);
  }
  return rates;
}

/** The rows of the first "Delivery Address:" block, joined with commas. */
function readDeliveryAddress(body: PdfLine[]): string | undefined {
  const index = body.findIndex((line) =>
    line.cells.some((cell) => /^Delivery Address:?$/i.test(cell.text)),
  );
  if (index === -1) return undefined;
  const labelIndex = body[index].cells.findIndex((cell) => /^Delivery Address/i.test(cell.text));
  const first = body[index].cells[labelIndex + 1];
  if (!first) return undefined;
  const parts = [first.text];
  for (const line of body.slice(index + 1)) {
    if (Math.abs((line.cells[0]?.x ?? 0) - first.x) > ADDRESS_COLUMN) break;
    parts.push(line.cells.map((cell) => cell.text).join(" "));
  }
  return parts.map((part) => part.replace(/,+$/, "")).join(", ");
}
