import { uniqueMonth } from "../support/test-data";
import { expect, test } from "./fixtures";

const damageCharge = (jobNo: string, date = "2026-09-12") => ({
  date,
  type: "SALE",
  jobNo,
  net: 85,
  vat: 17,
  gross: 102,
  lines: [
    { description: "Guard rail damaged beyond repair", chargeType: "OTHER", net: 85, vat: 17 },
  ],
});

test.describe("Services, repairs, damage and losses on site (R9)", () => {
  test(
    "a damage charge is flagged until the site records the damage",
    { tag: "@smoke" },
    async ({ request, api }) => {
      const order = await api.createOrder();
      const invoice = await api.createInvoice(order, damageCharge(order.supplierJobNo));
      expect(invoice.findings.map((f) => f.check)).toContain("R9");

      const event = await request.post(`/api/sites/${order.site.id}/service-events`, {
        data: {
          date: "2026-09-08",
          kind: "DAMAGE",
          description: "Guard rail bent by a forklift",
          confirmedBy: "Site manager",
        },
      });
      expect(event.status()).toBe(201);

      expect((await api.getInvoice(invoice.id)).findings.map((f) => f.check)).not.toContain("R9");
      const events = await (await request.get(`/api/sites/${order.site.id}/service-events`)).json();
      expect(events).toEqual([
        expect.objectContaining({ date: "2026-09-08", kind: "DAMAGE", fleetCode: null }),
      ]);
    },
  );

  test("rejects an event of an unknown kind, with 400", async ({ request, api }) => {
    const site = await api.createSite();
    const response = await request.post(`/api/sites/${site.id}/service-events`, {
      data: { date: "2026-09-08", kind: "PARTY", description: "x" },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error.issues[0].path).toEqual(["kind"]);
  });

  test("answers 404 for the events of a site that does not exist", async ({ request }) => {
    expect((await request.get("/api/sites/nope/service-events")).status()).toBe(404);
  });
});

test.describe("Query emails", () => {
  test("drafts a query about an invoice's open findings", async ({ request, api }) => {
    const order = await api.createOrder();
    const invoice = await api.createInvoice(order, damageCharge(order.supplierJobNo));

    const { email } = await (await request.get(`/api/invoices/${invoice.id}/query-email`)).json();

    expect(email.subject).toBe(`Query on invoice ${invoice.number}`);
    expect(email.body).toContain(`Invoice ${invoice.number}, 12/09/2026:`);
    expect(email.body).toContain("- Line 1: Guard rail damaged beyond repair charged at £85.00");
  });

  test("has no draft for an invoice with nothing to query", async ({ request, api }) => {
    const invoice = await api.createInvoice(await api.createOrder());
    const { email } = await (await request.get(`/api/invoices/${invoice.id}/query-email`)).json();
    expect(email).toBeNull();
  });

  test("drafts one query per supplier for the month", async ({ request, api }) => {
    const month = uniqueMonth();
    const order = await api.createOrder();
    await api.createInvoice(order, damageCharge(order.supplierJobNo, `${month}-12`));

    const emails = await (
      await request.get(`/api/reports/discrepancies/query-emails?month=${month}`)
    ).json();

    expect(emails).toEqual([
      expect.objectContaining({
        supplier: { id: order.supplier.id, name: order.supplier.name },
        subject: expect.stringMatching(/^Query on invoice /),
      }),
    ]);
  });
});

test.describe("Alerts", () => {
  test("flags long and costly hires, and items not collected", async ({ request, api }) => {
    const site = await api.createSite();
    await api.createOrder({ site, overrides: { startDate: "2026-01-05" } });
    const offHired = await api.createOrder({ site, overrides: { startDate: "2026-05-04" } });
    await api.offHire(offHired.id, { offHireDate: "2026-05-15" });

    const response = await request.get("/api/alerts?asOf=2026-06-01");

    expect(response.status()).toBe(200);
    const { alerts, settings } = await response.json();
    expect(settings).toEqual({ longHireDays: 84, costLimit: 1000, collectionDays: 7 });
    const ours = alerts.filter((a: { site: { id: string } }) => a.site.id === site.id);
    expect(ours.map((a: { kind: string }) => a.kind)).toEqual([
      "NOT_COLLECTED",
      "LONG_HIRE",
      "COSTLY",
    ]);
  });

  test("takes the limits from the query", async ({ request, api }) => {
    const site = await api.createSite();
    await api.createOrder({ site, overrides: { startDate: "2026-05-04" } });

    const { alerts } = await (
      await request.get("/api/alerts?asOf=2026-06-01&longHireDays=7&costLimit=100000")
    ).json();

    const ours = alerts.filter((a: { site: { id: string } }) => a.site.id === site.id);
    expect(ours.map((a: { kind: string }) => a.kind)).toEqual(["LONG_HIRE"]);
  });

  test("rejects a negative limit, with 400", async ({ request }) => {
    expect((await request.get("/api/alerts?costLimit=-1")).status()).toBe(400);
  });
});
