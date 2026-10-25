import { julyLine } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("On-hire register", () => {
  test("the site page shows what is on hire, since when, and what it has cost so far", async ({
    sitePage,
    api,
    request,
  }) => {
    const order = await api.createOrder({ overrides: { startDate: "2026-07-01" } });
    const fleetCode = order.items[0].fleetCode ?? "";
    await api.createInvoice(order, {
      date: "2026-07-31",
      net: 230,
      vat: 46,
      gross: 276,
      lines: [julyLine(fleetCode)],
    });
    // The page shows the register as of today: compare it with the API's, as of the same day.
    const register = await (await request.get(`/api/sites/${order.site.id}/on-hire`)).json();
    const [row] = register.rows;

    await sitePage.goto(order.site.id);

    await expect(sitePage.onHireCell(fleetCode, "Since")).toHaveText("2026-07-01");
    await expect(sitePage.onHireCell(fleetCode, "Working days")).toHaveText(
      String(row.chargeableDays),
    );
    await expect(sitePage.onHireCell(fleetCode, "Billed")).toHaveText("£230.00");
    await expect(sitePage.onHireCell(fleetCode, "Cost to date")).toHaveText(
      new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(row.costToDate),
    );
    await expect(sitePage.onHireCell(fleetCode, "Status")).toHaveText("On hire");
  });

  test("an off-hired item stays in the register until it is collected", async ({
    sitePage,
    api,
  }) => {
    const order = await api.createOrder();
    const fleetCode = order.items[0].fleetCode ?? "";
    await sitePage.goto(order.site.id);

    await sitePage.offHire(order.supplierJobNo, "2026-08-12");
    await expect(sitePage.onHireCell(fleetCode, "Status")).toHaveText(
      "Off hired, awaiting collection",
    );

    await sitePage.recordCollection(order.supplierJobNo, "C-5521");
    await expect(sitePage.onHireRow(fleetCode)).toHaveCount(0);
  });
});

test.describe("Payments", () => {
  test(
    "an overdue invoice is marked as paid from the payments page",
    { tag: "@smoke" },
    async ({ paymentsPage, invoicePage, api }) => {
      // Dated 31 August 2026, due 30 September 2026: overdue from then on.
      const invoice = await api.createInvoice(await api.createOrder());
      await paymentsPage.goto();
      await expect(paymentsPage.invoiceRow("Overdue", invoice.number)).toBeVisible();

      await paymentsPage.setStatus(invoice.number, "Mark paid");

      await expect(paymentsPage.invoiceRow("Overdue", invoice.number)).toHaveCount(0);
      await invoicePage.goto(invoice.id);
      await expect(invoicePage.headerValue("Payment")).toHaveText("Paid");
    },
  );

  test("a queried invoice is kept apart, on hold", async ({ paymentsPage, api }) => {
    const invoice = await api.createInvoice(await api.createOrder());
    await paymentsPage.goto();

    await paymentsPage.setStatus(invoice.number, "Query");

    await expect(paymentsPage.invoiceRow("Queried", invoice.number)).toBeVisible();
    await expect(paymentsPage.invoiceRow("Overdue", invoice.number)).toHaveCount(0);
  });

  test("the invoice page changes the payment status too", async ({ invoicePage, api, page }) => {
    const invoice = await api.createInvoice(await api.createOrder());
    await invoicePage.goto(invoice.id);
    await expect(invoicePage.headerValue("Payment")).toHaveText("Unpaid");

    await page.getByRole("button", { name: `Mark paid: ${invoice.number}` }).click();

    await expect(invoicePage.headerValue("Payment")).toHaveText("Paid");
  });

  test("the payments page has no accessibility violations", async ({
    paymentsPage,
    checkAccessibility,
  }) => {
    await paymentsPage.goto();
    await expect(paymentsPage.summary).toBeVisible();

    await checkAccessibility();
  });
});
