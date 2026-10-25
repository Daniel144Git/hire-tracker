import { describe, expect, it } from "vitest";
import {
  allocateMonth,
  linesWithInvoiceVat,
  totalsByMonth,
  type InvoiceForAllocation,
} from "@/lib/reports/allocation";

const rvs = { id: "rvs", code: "RVS", name: "Riverside Tower" };
const ngw = { id: "ngw", code: "NGW", name: "Northgate Wharf" };

function invoice(overrides: Partial<InvoiceForAllocation> = {}): InvoiceForAllocation {
  const lines = overrides.lines ?? [
    {
      description: "Scissor lift",
      fleetCode: "APX-SL-1",
      trade: "MECH" as const,
      net: 210,
      vat: 42,
    },
    { description: "Damage waiver", fleetCode: null, trade: "MECH" as const, net: 21, vat: 4.2 },
  ];
  return {
    id: "inv-1",
    number: "APX-1",
    date: "2026-08-31",
    site: rvs,
    vat: Math.round(lines.reduce((sum, line) => sum + line.vat, 0) * 100) / 100,
    ...overrides,
    lines,
  };
}

describe("linesWithInvoiceVat: the lines add up to the VAT printed on the invoice", () => {
  const lines = [
    { description: "A", fleetCode: null, trade: null, net: 0.13, vat: 0.03 },
    { description: "B", fleetCode: null, trade: null, net: 0.14, vat: 0.03 },
    { description: "C", fleetCode: null, trade: null, net: 0.12, vat: 0.02 },
  ];

  it("leaves the lines alone when they already add up", () => {
    expect(linesWithInvoiceVat({ vat: 0.08, lines }).map((l) => l.vat)).toEqual([0.03, 0.03, 0.02]);
  });

  it("takes a penny rounded once on the total from the largest line", () => {
    // 20% of the £0.39 net total is £0.078 = £0.08; the lines' own VAT adds up to £0.08 here,
    // so make the invoice say £0.07: the £0.14 line gives up the penny.
    expect(linesWithInvoiceVat({ vat: 0.07, lines }).map((l) => l.vat)).toEqual([0.03, 0.02, 0.02]);
  });

  it("spreads several pennies over the largest lines, one each", () => {
    expect(linesWithInvoiceVat({ vat: 0.1, lines }).map((l) => l.vat)).toEqual([0.04, 0.04, 0.02]);
  });

  it("ranks credit lines by size, not sign", () => {
    const credit = lines.map((l) => ({ ...l, net: -l.net, vat: -l.vat }));
    expect(linesWithInvoiceVat({ vat: -0.07, lines: credit }).map((l) => l.vat)).toEqual([
      -0.03, -0.02, -0.02,
    ]);
  });
});

describe("allocateMonth: the month's cost by site and trade", () => {
  it("adds up each site's lines by trade, with totals by trade and overall", () => {
    const report = allocateMonth(
      [
        invoice(),
        invoice({
          id: "inv-2",
          number: "APX-2",
          site: ngw,
          lines: [
            { description: "Generator", fleetCode: "GN-1", trade: "ELEC", net: 100, vat: 20 },
          ],
        }),
      ],
      "2026-08",
    );

    expect(report.trades).toEqual(["MECH", "ELEC"]);
    expect(report.sites.map((s) => [s.site?.code, s.cells, s.total])).toEqual([
      ["NGW", { ELEC: { net: 100, vat: 20, gross: 120 } }, { net: 100, vat: 20, gross: 120 }],
      [
        "RVS",
        { MECH: { net: 231, vat: 46.2, gross: 277.2 } },
        { net: 231, vat: 46.2, gross: 277.2 },
      ],
    ]);
    expect(report.totals).toEqual({
      byTrade: {
        MECH: { net: 231, vat: 46.2, gross: 277.2 },
        ELEC: { net: 100, vat: 20, gross: 120 },
      },
      total: { net: 331, vat: 66.2, gross: 397.2 },
    });
    expect(report.invoiceCount).toBe(2);
  });

  it("keeps the lines behind each site, with their invoice", () => {
    const [site] = allocateMonth([invoice()], "2026-08").sites;
    expect(site.lines[0]).toEqual({
      invoiceId: "inv-1",
      invoiceNumber: "APX-1",
      invoiceDate: "2026-08-31",
      trade: "MECH",
      description: "Scissor lift",
      fleetCode: "APX-SL-1",
      net: 210,
      vat: 42,
      gross: 252,
    });
  });

  it("only counts invoices dated in the month, credit notes included", () => {
    const report = allocateMonth(
      [
        invoice(),
        invoice({ id: "july", date: "2026-07-31" }),
        invoice({
          id: "credit",
          lines: [{ description: "Credit", fleetCode: null, trade: "MECH", net: -21, vat: -4.2 }],
        }),
      ],
      "2026-08",
    );
    expect(report.totals.total).toEqual({ net: 210, vat: 42, gross: 252 });
  });

  it("puts lines without a trade or an invoice without a site in their own buckets, last", () => {
    const report = allocateMonth(
      [
        invoice({
          site: null,
          lines: [{ description: "Unknown", fleetCode: null, trade: null, net: 10, vat: 2 }],
        }),
        invoice({ id: "inv-2" }),
      ],
      "2026-08",
    );
    expect(report.trades).toEqual(["MECH", "UNASSIGNED"]);
    expect(report.sites.map((s) => s.site?.code ?? null)).toEqual(["RVS", null]);
  });

  it("adds up to the invoices' printed VAT when it was rounded on the total", () => {
    const lines = [
      { description: "A", fleetCode: null, trade: "MECH" as const, net: 0.13, vat: 0.03 },
      { description: "B", fleetCode: null, trade: "ELEC" as const, net: 0.14, vat: 0.03 },
    ];
    const report = allocateMonth([invoice({ lines, vat: 0.05 })], "2026-08");
    expect(report.totals.total).toEqual({ net: 0.27, vat: 0.05, gross: 0.32 });
    expect(report.totals.byTrade.ELEC).toEqual({ net: 0.14, vat: 0.02, gross: 0.16 });
  });
});

describe("totalsByMonth: the year by site and month", () => {
  it("adds each site's invoices into its months, with month and year totals", () => {
    const report = totalsByMonth(
      [
        invoice(),
        invoice({ id: "inv-2", date: "2026-07-15" }),
        invoice({ id: "inv-3", date: "2026-08-01", site: ngw }),
        invoice({ id: "other-year", date: "2025-08-01" }),
      ],
      2026,
    );

    const rvsRow = report.sites.find((s) => s.site?.code === "RVS");
    expect(rvsRow?.months[6]).toEqual({ net: 231, vat: 46.2, gross: 277.2 });
    expect(rvsRow?.months[7]).toEqual({ net: 231, vat: 46.2, gross: 277.2 });
    expect(rvsRow?.months[0]).toEqual({ net: 0, vat: 0, gross: 0 });
    expect(rvsRow?.total).toEqual({ net: 462, vat: 92.4, gross: 554.4 });
    expect(report.monthTotals[7]).toEqual({ net: 462, vat: 92.4, gross: 554.4 });
    expect(report.total).toEqual({ net: 693, vat: 138.6, gross: 831.6 });
    expect(report.sites.map((s) => s.site?.code)).toEqual(["NGW", "RVS"]);
  });
});
