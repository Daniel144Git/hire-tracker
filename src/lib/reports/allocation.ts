import { fromPence, toPence } from "@/lib/money";
import { TRADES } from "@/lib/schemas/order";

export type Trade = (typeof TRADES)[number];
/** Lines with no trade (no linked order and none given) are reported apart, not guessed. */
export type TradeKey = Trade | "UNASSIGNED";

export interface SiteRef {
  id: string;
  code: string;
  name: string;
}

export interface LineForAllocation {
  description: string;
  fleetCode: string | null;
  /** The line's own trade, else its order's; null when neither is known. */
  trade: Trade | null;
  net: number;
  vat: number;
}

export interface InvoiceForAllocation {
  id: string;
  number: string;
  date: string;
  site: SiteRef | null;
  /** The VAT printed on the invoice. */
  vat: number;
  lines: LineForAllocation[];
}

export interface Money {
  net: number;
  vat: number;
  gross: number;
}

export interface AllocatedLine {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  trade: TradeKey;
  description: string;
  fleetCode: string | null;
  net: number;
  vat: number;
  gross: number;
}

export interface SiteAllocation {
  /** Null for invoices whose site is not known. */
  site: SiteRef | null;
  cells: Partial<Record<TradeKey, Money>>;
  total: Money;
  lines: AllocatedLine[];
}

export interface MonthlyAllocation {
  month: string;
  /** The trades that have costs this month, in the usual order. */
  trades: TradeKey[];
  sites: SiteAllocation[];
  totals: { byTrade: Partial<Record<TradeKey, Money>>; total: Money };
  invoiceCount: number;
}

const TRADE_ORDER: TradeKey[] = [...TRADES, "UNASSIGNED"];

interface SiteRow {
  site: SiteRef | null;
  cells: Map<TradeKey, Sum>;
  total: Sum;
  lines: AllocatedLine[];
}

/** Sums kept in pence, so adding hundreds of lines never drifts. */
class Sum {
  net = 0;
  vat = 0;
  add(net: number, vat: number) {
    this.net += toPence(net);
    this.vat += toPence(vat);
  }
  money(): Money {
    return {
      net: fromPence(this.net),
      vat: fromPence(this.vat),
      gross: fromPence(this.net + this.vat),
    };
  }
}

/**
 * The lines with their VAT adjusted to add up to the VAT printed on the invoice. A supplier that
 * rounds VAT once on the total is a penny or two away from the lines' own VAT; the difference
 * goes to the largest lines, a penny each, so every report adds up to the invoices.
 */
export function linesWithInvoiceVat<L extends { net: number; vat: number }>(invoice: {
  vat: number;
  lines: L[];
}): L[] {
  const pence = invoice.lines.map((line) => toPence(line.vat));
  let difference = toPence(invoice.vat) - pence.reduce((sum, value) => sum + value, 0);
  if (difference === 0 || invoice.lines.length === 0) return invoice.lines;
  const step = Math.sign(difference);
  const bySize = invoice.lines
    .map((line, index) => ({ index, size: Math.abs(line.net) }))
    .sort((a, b) => b.size - a.size || a.index - b.index);
  for (let i = 0; difference !== 0; i = (i + 1) % bySize.length) {
    pence[bySize[i].index] += step;
    difference -= step;
  }
  return invoice.lines.map((line, index) => ({ ...line, vat: fromPence(pence[index]) }));
}

const bySiteCode = (a: SiteRef | null, b: SiteRef | null) =>
  a === null ? 1 : b === null ? -1 : a.code.localeCompare(b.code);

/**
 * The month's hire cost by site and trade, as on the cost allocation tabs: an invoice belongs
 * to the month of its date, credit notes included. Each site keeps the lines behind its cells.
 */
export function allocateMonth(invoices: InvoiceForAllocation[], month: string): MonthlyAllocation {
  const inMonth = invoices.filter((invoice) => invoice.date.startsWith(`${month}-`));
  const sites = new Map<string, SiteRow>();
  const byTrade = new Map<TradeKey, Sum>();
  const total = new Sum();

  for (const invoice of inMonth) {
    const key = invoice.site?.id ?? "";
    const row: SiteRow = sites.get(key) ?? {
      site: invoice.site,
      cells: new Map(),
      total: new Sum(),
      lines: [],
    };
    sites.set(key, row);
    for (const line of linesWithInvoiceVat(invoice)) {
      const trade: TradeKey = line.trade ?? "UNASSIGNED";
      for (const sum of [
        row.cells.get(trade) ?? row.cells.set(trade, new Sum()).get(trade)!,
        byTrade.get(trade) ?? byTrade.set(trade, new Sum()).get(trade)!,
        row.total,
        total,
      ]) {
        sum.add(line.net, line.vat);
      }
      row.lines.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        invoiceDate: invoice.date,
        trade,
        description: line.description,
        fleetCode: line.fleetCode,
        net: line.net,
        vat: line.vat,
        gross: fromPence(toPence(line.net) + toPence(line.vat)),
      });
    }
  }

  const trades = TRADE_ORDER.filter((trade) => byTrade.has(trade));
  const moneyOf = (sums: Map<TradeKey, Sum>) =>
    Object.fromEntries(trades.filter((t) => sums.has(t)).map((t) => [t, sums.get(t)!.money()]));
  return {
    month,
    trades,
    sites: [...sites.values()]
      .sort((a, b) => bySiteCode(a.site, b.site))
      .map((row) => ({
        site: row.site,
        cells: moneyOf(row.cells),
        total: row.total.money(),
        lines: row.lines,
      })),
    totals: { byTrade: moneyOf(byTrade), total: total.money() },
    invoiceCount: inMonth.length,
  };
}

export interface YearlyTotals {
  year: number;
  /** months[0] is January. */
  sites: { site: SiteRef | null; months: Money[]; total: Money }[];
  monthTotals: Money[];
  total: Money;
}

/** The year by site and month, as on the "Total" tab: what each site cost each month. */
export function totalsByMonth(invoices: InvoiceForAllocation[], year: number): YearlyTotals {
  const twelve = () => Array.from({ length: 12 }, () => new Sum());
  const sites = new Map<string, { site: SiteRef | null; months: Sum[]; total: Sum }>();
  const monthTotals = twelve();
  const total = new Sum();
  for (const invoice of invoices.filter((i) => i.date.startsWith(`${year}-`))) {
    const month = Number(invoice.date.slice(5, 7)) - 1;
    const key = invoice.site?.id ?? "";
    const row = sites.get(key) ?? { site: invoice.site, months: twelve(), total: new Sum() };
    sites.set(key, row);
    for (const line of linesWithInvoiceVat(invoice)) {
      for (const sum of [row.months[month], row.total, monthTotals[month], total]) {
        sum.add(line.net, line.vat);
      }
    }
  }
  return {
    year,
    sites: [...sites.values()]
      .sort((a, b) => bySiteCode(a.site, b.site))
      .map((row) => ({
        site: row.site,
        months: row.months.map((m) => m.money()),
        total: row.total.money(),
      })),
    monthTotals: monthTotals.map((m) => m.money()),
    total: total.money(),
  };
}
