import { uniqueMonth } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("GET /api/reports/discrepancies", () => {
  test("lists the month's findings with their invoice, job and site, and the totals", async ({
    request,
    api,
  }) => {
    const month = uniqueMonth();
    const order = await api.createOrder({ overrides: { startDate: `${month}-01` } });
    const invoice = await api.createInvoice(order, {
      date: `${month}-28`,
      gross: 300,
      lines: [{ description: "Delivery", chargeType: "TRANSPORT", net: 231, vat: 46.2 }],
    });

    const response = await request.get(`/api/reports/discrepancies?month=${month}`);

    expect(response.status()).toBe(200);
    const report = await response.json();
    expect(report.month).toBe(month);
    expect(report.summary).toMatchObject({ invoices: 1, openFindings: invoice.findings.length });
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        invoice: { id: invoice.id, number: invoice.number, date: `${month}-28` },
        supplier: { id: order.supplier.id, name: order.supplier.name },
        jobNo: order.supplierJobNo,
        siteCode: order.site.code,
        check: "R10",
        message: "Gross £300.00 is not net + VAT, £277.20",
      }),
    );
  });

  test(
    "R4: lists an order on hire in the month with no invoice for it",
    { tag: "@smoke" },
    async ({ request, api }) => {
      const month = uniqueMonth();
      const order = await api.createOrder({ overrides: { startDate: `${month}-01` } });

      const response = await request.get(`/api/reports/discrepancies?month=${month}`);

      const { missingPeriods } = await response.json();
      expect(missingPeriods).toEqual([
        expect.objectContaining({
          check: "R4",
          orderId: order.id,
          supplierJobNo: order.supplierJobNo,
          siteCode: order.site.code,
          from: `${month}-01`,
          workingDaysOnHire: expect.any(Number),
        }),
      ]);
    },
  );

  test("leaves out invoices of other months", async ({ request, api }) => {
    const month = uniqueMonth();
    const order = await api.createOrder();
    await api.createInvoice(order, { gross: 300 });

    const response = await request.get(`/api/reports/discrepancies?month=${month}`);

    expect((await response.json()).summary.invoices).toBe(0);
  });

  // Playwright has no test.each: a loop declares one test per value.
  for (const month of ["2026-13", "2026-8", "August"]) {
    test(`rejects month=${month} with 400`, async ({ request }) => {
      const response = await request.get(`/api/reports/discrepancies?month=${month}`);

      expect(response.status()).toBe(400);
    });
  }
});
