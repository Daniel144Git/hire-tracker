import { uniqueMonth } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("Discrepancy report and site suspensions", () => {
  test(
    "the month's report lists an invoice's findings and opens the invoice",
    { tag: "@smoke" },
    async ({ reportPage, invoicePage, api }) => {
      const month = uniqueMonth();
      const order = await api.createOrder({ overrides: { startDate: `${month}-01` } });
      const invoice = await api.createInvoice(order, {
        date: `${month}-28`,
        gross: 300,
        lines: [{ description: "Delivery", chargeType: "TRANSPORT", net: 231, vat: 46.2 }],
      });

      await reportPage.goto(month);

      await expect(reportPage.summary).toContainText(`1 invoice dated ${month}`);
      await expect(reportPage.invoiceRows(invoice.number)).toContainText([
        /R10 VAT or totals.*Gross £300.00 is not net \+ VAT, £277.20/,
      ]);
      await reportPage.invoiceRows(invoice.number).getByRole("link").first().click();
      await expect(invoicePage.heading).toHaveText(`Invoice ${invoice.number}`);
    },
  );

  test("choosing a month shows the orders on hire with no invoice", async ({ reportPage, api }) => {
    const month = uniqueMonth();
    const order = await api.createOrder({ overrides: { startDate: `${month}-01` } });
    await reportPage.goto();

    await reportPage.showMonth(month);

    await expect(reportPage.missingPeriodRow(order.supplierJobNo)).toContainText(order.site.code);
  });

  test("a suspension recorded on the site page flags the invoice's missing credit", async ({
    sitePage,
    invoicePage,
    api,
  }) => {
    const order = await api.createOrder();
    const invoice = await api.createInvoice(order);
    await sitePage.goto(order.site.id);

    await sitePage.recordSuspension({
      from: "2026-08-10",
      to: "2026-08-21",
      freeDays: 10,
      note: "Site closed",
    });

    await expect(sitePage.suspensionsTable).toContainText("2026-08-10 to 2026-08-21");
    await invoicePage.goto(invoice.id);
    await expect(invoicePage.findingCell("R16", "Severity")).toHaveText("High");
    await expect(invoicePage.findingCell("R16", "Difference")).toHaveText("£100.00");
  });

  test("the report has no accessibility violations", async ({
    reportPage,
    api,
    checkAccessibility,
  }) => {
    const month = uniqueMonth();
    const order = await api.createOrder({ overrides: { startDate: `${month}-01` } });
    await api.createInvoice(order, { date: `${month}-28`, gross: 300 });

    await reportPage.goto(month);
    await expect(reportPage.findingsTable).toBeVisible();

    await checkAccessibility();
  });
});
