import { uniqueMonth } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("Costs by site and trade", () => {
  test(
    "shows the month's cost by site and trade, the lines behind it, and downloads them",
    { tag: "@smoke" },
    async ({ page, costsPage, api, checkAccessibility }) => {
      const month = uniqueMonth();
      const order = await api.createOrder({ overrides: { trade: "VENT" } });
      const invoice = await api.createInvoice(order, { date: `${month}-28` });

      await costsPage.goto(month);

      await expect(costsPage.summary).toHaveText("1 invoice: net £231.00, gross £277.20.");
      await expect(costsPage.siteRow(order.site.code).getByRole("cell")).toHaveText([
        "£231.00",
        "£231.00",
        "£277.20",
      ]);
      const lines = await costsPage.openLines(order.site.code);
      await expect(lines.getByRole("row")).toHaveCount(3);
      await expect(lines.getByRole("link", { name: invoice.number })).toHaveCount(2);
      await checkAccessibility();

      const download = page.waitForEvent("download");
      await costsPage.csvLink.click();
      expect((await download).suggestedFilename()).toBe(`hire-costs-${month}.csv`);
    },
  );

  test("shows each site's cost by month for the year", async ({ costsPage, api }) => {
    const month = uniqueMonth();
    const order = await api.createOrder();
    await api.createInvoice(order, { date: `${month}-28` });

    await costsPage.gotoYear(Number(month.slice(0, 4)));

    const row = costsPage.yearlyRow(order.site.code);
    await expect(row.getByRole("cell").nth(Number(month.slice(5)) - 1)).toHaveText("£277.20");
    await expect(row.getByRole("cell").last()).toHaveText("£277.20");
  });
});
