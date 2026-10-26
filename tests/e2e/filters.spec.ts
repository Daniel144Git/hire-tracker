import { uniqueMonth } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("Filters", () => {
  test(
    "filters the invoice list by supplier and month, and clears the filters",
    { tag: "@smoke" },
    async ({ page, api, checkAccessibility }) => {
      const month = uniqueMonth();
      const a = await api.createOrder();
      const b = await api.createOrder();
      const invoiceA = await api.createInvoice(a, { date: `${month}-28` });
      const invoiceB = await api.createInvoice(b, { date: `${month}-28` });
      await page.goto("/invoices");

      const form = page.getByRole("form", { name: "Filter invoices" });
      await form.getByLabel("Supplier").selectOption({ label: a.supplier.name });
      await form.getByLabel("Month").fill(month);
      await form.getByRole("button", { name: "Filter" }).click();

      const table = page.getByRole("table", { name: "Invoices" });
      await expect(table.getByRole("rowheader")).toHaveText([invoiceA.number]);
      await expect(form.getByLabel("Supplier")).toHaveValue(a.supplier.id);
      await checkAccessibility();

      await page.getByRole("link", { name: "Clear filters" }).click();
      await expect(page).toHaveURL(/\/invoices$/);
      await expect(table.getByRole("link", { name: invoiceB.number })).toBeVisible();
    },
  );

  test("shows one supplier's costs, and the downloads keep the filter", async ({ page, api }) => {
    const month = uniqueMonth();
    const a = await api.createOrder();
    await api.createInvoice(a, { date: `${month}-28` });
    await api.createInvoice(await api.createOrder(), { date: `${month}-28` });

    await page.goto(`/reports/costs?month=${month}&supplierId=${a.supplier.id}`);

    await expect(page.getByTestId("costs-summary")).toHaveText(
      "1 invoice: net £231.00, gross £277.20.",
    );
    await expect(page.getByRole("link", { name: "Download as Excel" })).toHaveAttribute(
      "href",
      `/api/reports/costs/export?month=${month}&supplierId=${a.supplier.id}&format=xlsx`,
    );
  });
});
