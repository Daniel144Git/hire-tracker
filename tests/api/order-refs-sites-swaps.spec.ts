import { itemData, julyLine, uniqueCode } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("Our order number", () => {
  test("links an invoice to the order by our order number", { tag: "@smoke" }, async ({ api }) => {
    const order = await api.createOrder();

    // A job number we do not know: the order is found by our order number.
    const invoice = await api.createInvoice(order, { orderRef: order.orderRef, jobNo: "J0000000" });

    expect(invoice.lines.map((line) => line.order?.id)).toEqual([order.id, order.id]);
    expect(invoice).toMatchObject({ site: { id: order.site.id }, siteMatchedBy: "ORDER" });
  });

  test("rejects an order number used by another order, with 409", async ({ request, api }) => {
    const existing = await api.createOrder();

    const response = await request.patch(`/api/orders/${(await api.createOrder()).id}`, {
      data: { orderRef: existing.orderRef },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error.code).toBe("DUPLICATE_ORDER_REF");
  });

  test("links an invoice that arrived before its order once the order is entered", async ({
    api,
  }) => {
    const supplier = await api.createSupplier();
    const site = await api.createSite();
    const orderRef = `PO-${uniqueCode(8)}`;
    const early = await api.createInvoiceForSupplier(supplier, {
      orderRef,
      lines: [{ description: "Delivery", chargeType: "TRANSPORT", net: 231, vat: 46.2 }],
    });
    expect(early.lines[0].linkProblem).toBe("UNKNOWN_ORDER_REF");

    const order = await api.createOrder({ supplier, site, overrides: { orderRef } });

    const relinked = await api.getInvoice(early.id);
    expect(relinked.lines[0]).toMatchObject({ order: { id: order.id }, linkProblem: null });
    expect(relinked.site?.id).toBe(site.id);
  });
});

test.describe("Items hired again on a new job", () => {
  test("an invoice of the new job moves to it once its order is entered", async ({ api }) => {
    // The same physical item (fleet code) was on a job at one site, went back, and was hired
    // again on a new job at another site. The invoice of the new job arrives first.
    const supplier = await api.createSupplier();
    const fleetCode = `APX-SL-${uniqueCode(4)}`;
    const oldJob = await api.createOrder({
      supplier,
      overrides: { items: [itemData({ fleetCode })] },
    });
    const newJobNo = `J${uniqueCode(7)}`;
    const invoice = await api.createInvoice(oldJob, { jobNo: newJobNo });
    expect(invoice.lines[0].order?.id).toBe(oldJob.id);

    const newJob = await api.createOrder({
      supplier,
      overrides: { supplierJobNo: newJobNo, items: [itemData({ fleetCode })] },
    });

    const relinked = await api.getInvoice(invoice.id);
    expect(relinked.lines.map((line) => line.order?.id)).toEqual([newJob.id, newJob.id]);
    expect(relinked.site?.id).toBe(newJob.site.id);
  });
});

test.describe("Site recognition", () => {
  test("recognises a site from an alias recorded for it", async ({ request, api }) => {
    const site = await api.createSite();
    const alias = `Site ${uniqueCode(6)}`;
    const saved = await request.put(`/api/sites/${site.id}/aliases`, {
      data: { aliases: [alias, ` ${alias.toLowerCase()} `] },
    });
    expect(await saved.json()).toMatchObject({ aliases: [alias.toUpperCase()] });

    const response = await request.get(
      `/api/sites/recognize?customerRef=${encodeURIComponent(alias.toLowerCase())}`,
    );

    expect(await response.json()).toEqual({
      site: { id: site.id, code: site.code, name: site.name },
      matchedBy: "ALIAS",
      candidates: [{ id: site.id, code: site.code, name: site.name }],
    });
  });

  test("gives an invoice with no order the site recognised from its customer reference", async ({
    api,
  }) => {
    const site = await api.createSite({ name: `Quayside ${uniqueCode(6)}` });
    const supplier = await api.createSupplier();

    const invoice = await api.createInvoiceForSupplier(supplier, {
      customerRef: site.name.toUpperCase(),
      lines: [{ description: "Delivery", chargeType: "TRANSPORT", net: 231, vat: 46.2 }],
    });

    expect(invoice).toMatchObject({ site: { id: site.id }, siteMatchedBy: "NAME" });
  });

  test("rejects an alias that belongs to another site, with 409", async ({ request, api }) => {
    const [site, other] = await Promise.all([api.createSite(), api.createSite()]);
    const alias = `Alias ${uniqueCode(6)}`;
    await request.put(`/api/sites/${other.id}/aliases`, { data: { aliases: [alias] } });

    const response = await request.put(`/api/sites/${site.id}/aliases`, {
      data: { aliases: [alias] },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error.code).toBe("DUPLICATE_ALIAS");
  });

  test("needs a customer reference or an address to recognise a site", async ({ request }) => {
    const response = await request.get("/api/sites/recognize");

    expect(response.status()).toBe(400);
  });
});

test.describe("Fleet code changes (E-codes)", () => {
  test(
    "a recorded swap links the new code to the item and clears R8 and R15",
    { tag: "@smoke" },
    async ({ request, api }) => {
      const order = await api.createOrder({
        overrides: {
          startDate: "2026-07-01",
          items: [itemData(), itemData({ description: "Pipe groover 2-6in", weeklyRate: 41.29 })],
        },
      });
      const [lift, groover] = order.items;
      const newCode = `APX-PG-${uniqueCode(4)}`;
      await api.createInvoice(order, {
        date: "2026-07-31",
        net: 419.93,
        vat: 83.99,
        gross: 503.92,
        lines: [
          julyLine(lift.fleetCode),
          julyLine(groover.fleetCode, {
            description: "Pipe groover 2-6in",
            net: 189.93,
            vat: 37.99,
          }),
        ],
      });
      // August: the groover is billed under a new code nobody recorded yet.
      const august = await api.createInvoice(order, {
        net: 383.42,
        vat: 76.68,
        gross: 460.1,
        lines: [
          {
            ...julyLine(lift.fleetCode),
            periodFrom: "2026-08-01",
            periodTo: "2026-08-31",
            net: 210,
            vat: 42,
          },
          {
            ...julyLine(newCode),
            description: "Pipe groover 2-6in",
            periodFrom: "2026-08-01",
            periodTo: "2026-08-31",
            net: 173.42,
            vat: 34.68,
          },
        ],
      });
      expect(august.findings.map((f) => f.check).sort()).toEqual(["R13", "R15", "R8"]);
      expect(august.findings.find((f) => f.check === "R15")?.message).toContain("swapped");

      const response = await request.post(
        `/api/orders/${order.id}/items/${groover.id}/fleet-code`,
        {
          data: { newCode, changedOn: "2026-08-01", note: "Groover swapped by the supplier" },
        },
      );

      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        fleetCode: newCode,
        fleetCodeHistory: [{ oldCode: groover.fleetCode, newCode, changedOn: "2026-08-01" }],
      });
      const rechecked = await api.getInvoice(august.id);
      expect(rechecked.lines[1]).toMatchObject({ hireItem: { id: groover.id }, linkProblem: null });
      expect(rechecked.findings.map((f) => f.check)).toEqual(["R13"]);
    },
  );

  test("rejects a 'new' code the item already has", async ({ request, api }) => {
    const order = await api.createOrder();
    const [item] = order.items;

    const response = await request.post(`/api/orders/${order.id}/items/${item.id}/fleet-code`, {
      data: { newCode: item.fleetCode, changedOn: "2026-08-01" },
    });

    expect(response.status()).toBe(400);
  });

  test("returns 404 for an item that is not on the order", async ({ request, api }) => {
    const order = await api.createOrder();

    const response = await request.post(`/api/orders/${order.id}/items/no-such-item/fleet-code`, {
      data: { newCode: "APX-ZZ-0001", changedOn: "2026-08-01" },
    });

    expect(response.status()).toBe(404);
  });
});
