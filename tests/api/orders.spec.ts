import { itemData, orderData } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("POST /api/orders", () => {
  test(
    "creates an order on hire with its items, rates in pounds",
    { tag: "@smoke" },
    async ({ request, api }) => {
      const [supplier, site] = await Promise.all([api.createSupplier(), api.createSite()]);
      const data = orderData(
        { supplierId: supplier.id, siteId: site.id },
        {
          items: [
            itemData({ fleetCode: "apx-sl-1042", weeklyRate: 41.29 }),
            itemData({ description: "Outrigger adaptor", weeklyRate: 3.75, isAccessory: true }),
          ],
        },
      );

      const response = await request.post("/api/orders", { data });

      expect(response.status()).toBe(201);
      const order = await response.json();
      expect(order).toMatchObject({
        supplierJobNo: data.supplierJobNo,
        supplier: { id: supplier.id, name: supplier.name },
        site: { id: site.id, code: site.code },
        trade: "MECH",
        startDate: "2026-08-03",
        status: "ON_HIRE",
        offHireDate: null,
        collectionNo: null,
      });
      expect(order.items).toEqual([
        expect.objectContaining({ fleetCode: "APX-SL-1042", weeklyRate: 41.29, qty: 1 }),
        expect.objectContaining({ description: "Outrigger adaptor", weeklyRate: 3.75 }),
      ]);
    },
  );

  test("applies damage waiver by default when the supplier charges one", async ({ api }) => {
    const supplier = await api.createSupplier({ damageWaiverPct: 10 });

    const order = await api.createOrder({ supplier });

    expect(order.damageWaiverApplies).toBe(true);
  });

  test("does not apply damage waiver by default when the supplier charges 0%", async ({ api }) => {
    const supplier = await api.createSupplier({ damageWaiverPct: 0 });

    const order = await api.createOrder({ supplier });

    expect(order.damageWaiverApplies).toBe(false);
  });

  test("rejects a site that does not exist with 400 on siteId", async ({ request, api }) => {
    const supplier = await api.createSupplier();

    const response = await request.post("/api/orders", {
      data: orderData({ supplierId: supplier.id, siteId: "no-such-site" }),
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.issues).toEqual([
      { path: ["siteId"], message: "Site not found" },
    ]);
  });

  test("rejects a job number the same supplier already used, with 409", async ({
    request,
    api,
  }) => {
    const existing = await api.createOrder();

    const response = await request.post("/api/orders", {
      data: orderData(
        { supplierId: existing.supplier.id, siteId: existing.site.id },
        { supplierJobNo: existing.supplierJobNo },
      ),
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error.code).toBe("DUPLICATE_JOB_NO");
  });

  test("accepts the same job number from a different supplier", async ({ api }) => {
    const existing = await api.createOrder();

    const order = await api.createOrder({ overrides: { supplierJobNo: existing.supplierJobNo } });

    expect(order.supplierJobNo).toBe(existing.supplierJobNo);
  });

  test("reports an invalid item field with its full path", async ({ request, api }) => {
    const [supplier, site] = await Promise.all([api.createSupplier(), api.createSite()]);

    const response = await request.post("/api/orders", {
      data: orderData(
        { supplierId: supplier.id, siteId: site.id },
        { items: [itemData({ weeklyRate: 41.295 })] },
      ),
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.issues).toEqual([
      { path: ["items", 0, "weeklyRate"], message: "Must have at most 2 decimal places" },
    ]);
  });
});

test.describe("GET /api/orders", () => {
  test("filters by site", async ({ request, api }) => {
    const supplier = await api.createSupplier();
    const [site, otherSite] = await Promise.all([api.createSite(), api.createSite()]);
    const order = await api.createOrder({ supplier, site });
    await api.createOrder({ supplier, site: otherSite });

    const response = await request.get(`/api/orders?siteId=${site.id}`);

    expect(response.status()).toBe(200);
    expect((await response.json()).map((o: { id: string }) => o.id)).toEqual([order.id]);
  });

  test("filters by site and status", async ({ request, api }) => {
    const [supplier, site] = await Promise.all([api.createSupplier(), api.createSite()]);
    await api.createOrder({ supplier, site });
    const offHired = await api.createOrder({ supplier, site });
    await api.offHire(offHired.id, { offHireDate: "2026-08-20" });

    const response = await request.get(`/api/orders?siteId=${site.id}&status=OFF_HIRED`);

    expect((await response.json()).map((o: { id: string }) => o.id)).toEqual([offHired.id]);
  });

  test("rejects an unknown status filter with 400", async ({ request }) => {
    const response = await request.get("/api/orders?status=LOST");

    expect(response.status()).toBe(400);
  });
});

test.describe("GET and PATCH /api/orders/:id", () => {
  test("returns one order by id", async ({ request, api }) => {
    const order = await api.createOrder();

    const response = await request.get(`/api/orders/${order.id}`);

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(order);
  });

  test("returns 404 for an order that does not exist", async ({ request }) => {
    const response = await request.get("/api/orders/does-not-exist");

    expect(response.status()).toBe(404);
  });

  test("changes the trade of an order", async ({ request, api }) => {
    const order = await api.createOrder();

    const response = await request.patch(`/api/orders/${order.id}`, { data: { trade: "VENT" } });

    expect(response.status()).toBe(200);
    expect((await response.json()).trade).toBe("VENT");
  });

  test("does not let the status be changed directly", async ({ request, api }) => {
    const order = await api.createOrder();

    const response = await request.patch(`/api/orders/${order.id}`, {
      data: { status: "COLLECTED" },
    });

    expect(response.status()).toBe(400);
  });
});

test.describe("POST /api/orders/:id/items", () => {
  test("adds an accessory to an existing order", async ({ request, api }) => {
    const order = await api.createOrder();

    const response = await request.post(`/api/orders/${order.id}/items`, {
      data: itemData({ description: "Platform extension", weeklyRate: 5.5, isAccessory: true }),
    });

    expect(response.status()).toBe(201);
    expect(await response.json()).toMatchObject({
      description: "Platform extension",
      weeklyRate: 5.5,
      isAccessory: true,
    });
  });

  test("returns 404 when the order does not exist", async ({ request }) => {
    const response = await request.post("/api/orders/does-not-exist/items", { data: itemData() });

    expect(response.status()).toBe(404);
  });
});

test.describe("POST /api/orders/:id/off-hire", () => {
  test("off-hires an order on hire", { tag: "@smoke" }, async ({ request, api }) => {
    const order = await api.createOrder();

    const response = await request.post(`/api/orders/${order.id}/off-hire`, {
      data: { offHireDate: "2026-08-12" },
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "OFF_HIRED",
      offHireDate: "2026-08-12",
      collectionNo: null,
    });
  });

  test("marks the order COLLECTED when the collection number is given", async ({
    request,
    api,
  }) => {
    const order = await api.createOrder();

    const response = await request.post(`/api/orders/${order.id}/off-hire`, {
      data: { offHireDate: "2026-08-12", collectionNo: "c-5521" },
    });

    expect(await response.json()).toMatchObject({ status: "COLLECTED", collectionNo: "C-5521" });
  });

  test("rejects an off-hire date before the start of hire with 400", async ({ request, api }) => {
    const order = await api.createOrder({ overrides: { startDate: "2026-08-03" } });

    const response = await request.post(`/api/orders/${order.id}/off-hire`, {
      data: { offHireDate: "2026-07-31" },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe("OFF_HIRE_BEFORE_START");
  });

  test("rejects off-hiring the same order twice with 409", async ({ request, api }) => {
    const order = await api.createOrder();
    await api.offHire(order.id, { offHireDate: "2026-08-12" });

    const response = await request.post(`/api/orders/${order.id}/off-hire`, {
      data: { offHireDate: "2026-08-14" },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error.code).toBe("ORDER_NOT_ON_HIRE");
  });

  test("rejects a date that does not exist with 400", async ({ request, api }) => {
    const order = await api.createOrder();

    const response = await request.post(`/api/orders/${order.id}/off-hire`, {
      data: { offHireDate: "2026-09-31" },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.issues[0].path).toEqual(["offHireDate"]);
  });

  test("returns 404 when the order does not exist", async ({ request }) => {
    const response = await request.post("/api/orders/does-not-exist/off-hire", {
      data: { offHireDate: "2026-08-12" },
    });

    expect(response.status()).toBe(404);
  });
});

test.describe("POST /api/orders/:id/collection", () => {
  test("records the collection of an off-hired order", async ({ request, api }) => {
    const order = await api.createOrder();
    await api.offHire(order.id, { offHireDate: "2026-08-12" });

    const response = await request.post(`/api/orders/${order.id}/collection`, {
      data: { collectionNo: "C-5521" },
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "COLLECTED",
      offHireDate: "2026-08-12",
      collectionNo: "C-5521",
    });
  });

  test("rejects a collection for an order still on hire with 409", async ({ request, api }) => {
    const order = await api.createOrder();

    const response = await request.post(`/api/orders/${order.id}/collection`, {
      data: { collectionNo: "C-5521" },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error.code).toBe("ORDER_NOT_OFF_HIRED");
  });
});
