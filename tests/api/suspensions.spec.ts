import { expect, test } from "./fixtures";

const tenFreeDays = { periodFrom: "2026-08-10", periodTo: "2026-08-21", freeDays: 10 };

test.describe("Site suspensions", () => {
  test("records a suspension and lists it", async ({ request, api }) => {
    const site = await api.createSite();

    const created = await request.post(`/api/sites/${site.id}/suspensions`, {
      data: { ...tenFreeDays, note: "Site closed: crane works" },
    });
    const list = await request.get(`/api/sites/${site.id}/suspensions`);

    expect(created.status()).toBe(201);
    expect(await list.json()).toEqual([
      { id: expect.any(String), siteId: site.id, ...tenFreeDays, note: "Site closed: crane works" },
    ]);
  });

  test("rejects a period that ends before it starts, and zero free days", async ({
    request,
    api,
  }) => {
    const site = await api.createSite();

    const response = await request.post(`/api/sites/${site.id}/suspensions`, {
      data: { periodFrom: "2026-08-21", periodTo: "2026-08-10", freeDays: 0 },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.issues.map((i: { path: string[] }) => i.path)).toEqual([
      ["freeDays"],
      ["periodTo"],
    ]);
  });

  test("returns 404 for a site that does not exist", async ({ request }) => {
    const response = await request.post("/api/sites/no-such-site/suspensions", {
      data: tenFreeDays,
    });

    expect(response.status()).toBe(404);
  });

  test("R16: a suspension re-checks the site's invoices for the missing credit", async ({
    api,
  }) => {
    const order = await api.createOrder();
    const invoice = await api.createInvoice(order);
    expect(invoice.findings).toEqual([]);

    await api.createSuspension(order.site.id, tenFreeDays);

    const rechecked = await api.getInvoice(invoice.id);
    expect(rechecked.findings).toEqual([
      expect.objectContaining({
        check: "R16",
        severity: "HIGH",
        message: `Site ${order.site.code} was suspended from 2026-08-10 to 2026-08-21 (10 free days), but there is no suspension credit for this line`,
        expected: -100,
      }),
    ]);
  });
});
