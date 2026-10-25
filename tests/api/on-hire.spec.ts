import { julyLine } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("GET /api/sites/:id/on-hire", () => {
  test(
    "lists each item on site with days on hire, cost to date and what was billed",
    { tag: "@smoke" },
    async ({ request, api }) => {
      const order = await api.createOrder({ overrides: { startDate: "2026-07-01" } });
      await api.createInvoice(order, {
        date: "2026-07-31",
        net: 230,
        vat: 46,
        gross: 276,
        lines: [julyLine(order.items[0].fleetCode)],
      });

      const response = await request.get(`/api/sites/${order.site.id}/on-hire?asOf=2026-09-15`);

      expect(response.status()).toBe(200);
      const register = await response.json();
      expect(register).toMatchObject({
        site: { id: order.site.id, code: order.site.code },
        asOf: "2026-09-15",
        totals: { items: 1, costToDate: 550, billedToDate: 230, notYetBilled: 320 },
      });
      expect(register.rows).toEqual([
        expect.objectContaining({
          supplierJobNo: order.supplierJobNo,
          fleetCode: order.items[0].fleetCode,
          status: "ON_HIRE",
          calendarDaysOnHire: 77,
          chargeableDays: 55,
          costToDate: 550,
          billedToDate: 230,
          notYetBilled: 320,
        }),
      ]);
    },
  );

  test("keeps an off-hired item until it is collected", async ({ request, api }) => {
    const site = await api.createSite();
    const supplier = await api.createSupplier();
    const awaitingCollection = await api.createOrder({ site, supplier });
    const collected = await api.createOrder({ site, supplier });
    await api.offHire(awaitingCollection.id, { offHireDate: "2026-08-12" });
    await api.offHire(collected.id, { offHireDate: "2026-08-12", collectionNo: "C-1" });

    const response = await request.get(`/api/sites/${site.id}/on-hire?asOf=2026-09-15`);

    const { rows } = await response.json();
    expect(rows.map((r: { orderId: string; status: string }) => [r.orderId, r.status])).toEqual([
      [awaitingCollection.id, "OFF_HIRED"],
    ]);
  });

  test("uses today when no date is given", async ({ request, api }) => {
    const site = await api.createSite();

    const response = await request.get(`/api/sites/${site.id}/on-hire`);

    expect((await response.json()).asOf).toBe(new Date().toISOString().slice(0, 10));
  });

  test("rejects a date that does not exist with 400", async ({ request, api }) => {
    const site = await api.createSite();

    const response = await request.get(`/api/sites/${site.id}/on-hire?asOf=2026-02-30`);

    expect(response.status()).toBe(400);
  });

  test("returns 404 for a site that does not exist", async ({ request }) => {
    const response = await request.get("/api/sites/no-such-site/on-hire");

    expect(response.status()).toBe(404);
  });
});
