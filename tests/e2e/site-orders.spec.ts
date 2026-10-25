import { uniqueCode } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("Hire orders on a site", () => {
  test("creates a hire order from the site page", async ({ sitePage, api }) => {
    const [supplier, site] = await Promise.all([api.createSupplier(), api.createSite()]);
    const jobNo = `J${uniqueCode(7)}`;
    await sitePage.goto(site.id);

    await sitePage.createOrder({
      supplierName: supplier.name,
      jobNo,
      trade: "ELEC",
      startDate: "2026-08-13",
      description: "Mobile platform 3m",
      fleetCode: "APX-MP-0588",
      weeklyRate: 35,
    });

    await expect(sitePage.cell(jobNo, "Status")).toHaveText("On hire");
    await expect(sitePage.cell(jobNo, "Items")).toHaveText(
      "Mobile platform 3m (APX-MP-0588) £35.00/wk",
    );
  });

  test(
    "off-hires an item and the order shows the off-hire date",
    { tag: "@smoke" },
    async ({ sitePage, api, request }) => {
      const order = await api.createOrder({ overrides: { startDate: "2026-08-03" } });
      await sitePage.goto(order.site.id);

      await sitePage.offHire(order.supplierJobNo, "2026-08-12");

      await expect(sitePage.cell(order.supplierJobNo, "Status")).toHaveText("Off hired");
      await expect(sitePage.cell(order.supplierJobNo, "Off-hire")).toHaveText("2026-08-12");
      // The UI change is saved: the API returns the same state.
      const saved = await (await request.get(`/api/orders/${order.id}`)).json();
      expect(saved).toMatchObject({ status: "OFF_HIRED", offHireDate: "2026-08-12" });
    },
  );

  test("off-hires with the collection number in one step", async ({ sitePage, api }) => {
    const order = await api.createOrder();
    await sitePage.goto(order.site.id);

    await sitePage.offHire(order.supplierJobNo, "2026-08-12", "C-5521");

    await expect(sitePage.cell(order.supplierJobNo, "Status")).toHaveText("Collected");
    await expect(sitePage.cell(order.supplierJobNo, "Collection no")).toHaveText("C-5521");
  });

  test("records the collection of an off-hired order", async ({ sitePage, api }) => {
    const order = await api.createOrder();
    await api.offHire(order.id, { offHireDate: "2026-08-12" });
    await sitePage.goto(order.site.id);

    await sitePage.recordCollection(order.supplierJobNo, "C-5521");

    await expect(sitePage.cell(order.supplierJobNo, "Status")).toHaveText("Collected");
  });

  test("refuses an off-hire date before the start of hire", async ({ sitePage, api }) => {
    const order = await api.createOrder({ overrides: { startDate: "2026-08-03" } });
    await sitePage.goto(order.site.id);

    await sitePage.offHire(order.supplierJobNo, "2026-07-31");

    const dateInput = sitePage.offHireForm(order.supplierJobNo).getByLabel("Off-hire date");
    await expect(dateInput).toHaveAccessibleDescription(
      "Off-hire date 2026-07-31 is before the start of hire 2026-08-03",
    );
    await expect(sitePage.cell(order.supplierJobNo, "Status")).toHaveText("On hire");
  });

  test("shows 'Page not found' for a site that does not exist", async ({ page }) => {
    await page.goto("/sites/does-not-exist");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  });

  test("has no accessibility violations", async ({ sitePage, api, checkAccessibility }) => {
    const order = await api.createOrder();
    await sitePage.goto(order.site.id);
    await expect(sitePage.ordersTable).toBeVisible();

    await checkAccessibility();
  });
});
