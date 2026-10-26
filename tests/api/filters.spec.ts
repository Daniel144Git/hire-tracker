import { uniqueMonth } from "../support/test-data";
import { expect, test } from "./fixtures";

// Two suppliers with invoices in the same random month: every filter must keep them apart.
async function twoSuppliers(api: import("../support/api-client").ApiClient) {
  const month = uniqueMonth();
  const a = await api.createOrder();
  const b = await api.createOrder({ overrides: { trade: "ELEC" } });
  const invoiceA = await api.createInvoice(a, { date: `${month}-28` });
  // R5 on B: billed £10.00 more than the agreed rate gives.
  const invoiceB = await api.createInvoice(b, {
    date: `${month}-28`,
    net: 241,
    vat: 48.2,
    gross: 289.2,
    lines: [
      {
        description: "Scissor lift 19ft electric",
        fleetCode: b.items[0].fleetCode,
        periodFrom: `${month}-01`,
        periodTo: `${month}-28`,
        chargeType: "HIRE",
        net: 220,
        vat: 44,
      },
      { description: "Damage waiver 10%", chargeType: "DAMAGE_WAIVER", net: 21, vat: 4.2 },
    ],
  });
  return { month, a, b, invoiceA, invoiceB };
}

test.describe("Filters", () => {
  test("lists invoices by supplier, site, month, payment and open findings", async ({
    request,
    api,
  }) => {
    const { month, a, b, invoiceA, invoiceB } = await twoSuppliers(api);
    await api.updateInvoice(invoiceA.id, { paymentStatus: "PAID" });
    const list = async (query: string) =>
      (await (await request.get(`/api/invoices?${query}`)).json()).map(
        (i: { number: string }) => i.number,
      );

    expect(await list(`month=${month}&supplierId=${a.supplier.id}`)).toEqual([invoiceA.number]);
    expect(await list(`month=${month}&siteId=${b.site.id}`)).toEqual([invoiceB.number]);
    expect(await list(`month=${month}&paymentStatus=PAID&siteId=${a.site.id}`)).toEqual([
      invoiceA.number,
    ]);
    expect(await list(`month=${month}&openFindings=true&siteId=${b.site.id}`)).toEqual([
      invoiceB.number,
    ]);
    // An empty filter, as an empty form field sends it, means "all".
    expect(await list(`month=${month}&supplierId=&siteId=${a.site.id}`)).toEqual([invoiceA.number]);
  });

  test("rejects a month that is not YYYY-MM, with 400", async ({ request }) => {
    expect((await request.get("/api/invoices?month=2026-13")).status()).toBe(400);
  });

  test("limits the discrepancy report and its query emails to a supplier or a site", async ({
    request,
    api,
  }) => {
    const { month, a, b } = await twoSuppliers(api);

    const report = await (
      await request.get(`/api/reports/discrepancies?month=${month}&supplierId=${b.supplier.id}`)
    ).json();
    expect(
      new Set(report.findings.map((f: { supplier: { id: string } }) => f.supplier.id)),
    ).toEqual(new Set([b.supplier.id]));
    const bySite = await (
      await request.get(`/api/reports/discrepancies?month=${month}&siteId=${a.site.id}`)
    ).json();
    expect(bySite.summary.invoices).toBe(1);

    const emails = await (
      await request.get(
        `/api/reports/discrepancies/query-emails?month=${month}&supplierId=${b.supplier.id}`,
      )
    ).json();
    expect(emails.map((e: { supplier: { id: string } }) => e.supplier.id)).toEqual([b.supplier.id]);
  });

  test("limits the cost reports and their exports to a supplier", async ({ request, api }) => {
    const { month, a } = await twoSuppliers(api);
    const year = month.slice(0, 4);

    const costs = await (
      await request.get(`/api/reports/costs?month=${month}&supplierId=${a.supplier.id}`)
    ).json();
    expect(costs).toMatchObject({
      invoiceCount: 1,
      trades: ["MECH"],
      totals: { total: { net: 231, vat: 46.2, gross: 277.2 } },
    });

    const csv = await (
      await request.get(
        `/api/reports/costs/export?month=${month}&format=csv&supplierId=${a.supplier.id}`,
      )
    ).text();
    expect(csv.trim().split("\r\n")).toHaveLength(3);

    const yearly = await (
      await request.get(`/api/reports/yearly?year=${year}&supplierId=${a.supplier.id}`)
    ).json();
    expect(yearly.sites.map((s: { site: { id: string } }) => s.site.id)).toEqual([a.site.id]);
  });

  test("limits the alerts to a supplier or a site", async ({ request, api }) => {
    const site = await api.createSite();
    const kept = await api.createOrder({ site, overrides: { startDate: "2026-01-05" } });
    await api.createOrder({ site, overrides: { startDate: "2026-01-05" } });

    const { alerts } = await (
      await request.get(`/api/alerts?asOf=2026-06-01&supplierId=${kept.supplier.id}`)
    ).json();

    expect(new Set(alerts.map((a: { supplierJobNo: string }) => a.supplierJobNo))).toEqual(
      new Set([kept.supplierJobNo]),
    );
    const bySite = await (
      await request.get(`/api/alerts?asOf=2026-06-01&siteId=${site.id}`)
    ).json();
    expect(new Set(bySite.alerts.map((a: { site: { id: string } }) => a.site.id))).toEqual(
      new Set([site.id]),
    );
  });
});
