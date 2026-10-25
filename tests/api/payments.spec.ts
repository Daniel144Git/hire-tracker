import type { ApiClient } from "../support/api-client";
import { uniqueMonth } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("PATCH /api/invoices/:id", () => {
  test("marks an invoice as paid", async ({ request, api }) => {
    const invoice = await api.createInvoice(await api.createOrder());

    const response = await request.patch(`/api/invoices/${invoice.id}`, {
      data: { paymentStatus: "PAID" },
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ id: invoice.id, paymentStatus: "PAID" });
  });

  test("rejects a payment status that does not exist", async ({ request, api }) => {
    const invoice = await api.createInvoice(await api.createOrder());

    const response = await request.patch(`/api/invoices/${invoice.id}`, {
      data: { paymentStatus: "HALF_PAID" },
    });

    expect(response.status()).toBe(400);
  });

  test("does not let the amounts of an invoice be changed", async ({ request, api }) => {
    const invoice = await api.createInvoice(await api.createOrder());

    const response = await request.patch(`/api/invoices/${invoice.id}`, { data: { gross: 0 } });

    expect(response.status()).toBe(400);
    expect((await api.getInvoice(invoice.id)).gross).toBe(277.2);
  });

  test("returns 404 for an invoice that does not exist", async ({ request }) => {
    const response = await request.patch("/api/invoices/no-such-invoice", {
      data: { paymentStatus: "PAID" },
    });

    expect(response.status()).toBe(404);
  });
});

test.describe("GET /api/payments/due", () => {
  // A far-future month keeps these invoices apart from the other tests' invoices.
  async function invoicesDue(api: ApiClient) {
    const month = uniqueMonth();
    const order = await api.createOrder({ overrides: { startDate: `${month}-01` } });
    const lines = [{ description: "Delivery", chargeType: "TRANSPORT", net: 231, vat: 46.2 }];
    const overdue = await api.createInvoice(order, {
      date: `${month}-01`,
      dueDate: `${month}-02`,
      lines,
    });
    const dueSoon = await api.createInvoice(order, {
      date: `${month}-01`,
      dueDate: `${month}-09`,
      lines,
    });
    return { month, order, overdue, dueSoon };
  }

  test(
    "groups unpaid invoices into overdue and due within 7 days",
    { tag: "@smoke" },
    async ({ request, api }) => {
      const { month, order, overdue, dueSoon } = await invoicesDue(api);

      const response = await request.get(`/api/payments/due?asOf=${month}-05`);

      expect(response.status()).toBe(200);
      const due = await response.json();
      expect(due.asOf).toBe(`${month}-05`);
      expect(due.overdue).toContainEqual(
        expect.objectContaining({
          id: overdue.id,
          daysOverdue: 3,
          siteCode: order.site.code,
          gross: 277.2,
        }),
      );
      expect(due.dueIn7Days).toContainEqual(
        expect.objectContaining({ id: dueSoon.id, daysUntilDue: 4 }),
      );
    },
  );

  test("leaves out an invoice once it is paid, and keeps a queried one apart", async ({
    request,
    api,
  }) => {
    const { month, overdue, dueSoon } = await invoicesDue(api);
    await request.patch(`/api/invoices/${overdue.id}`, { data: { paymentStatus: "PAID" } });
    await request.patch(`/api/invoices/${dueSoon.id}`, { data: { paymentStatus: "QUERIED" } });

    const due = await (await request.get(`/api/payments/due?asOf=${month}-05`)).json();

    const ids = (list: { id: string }[]) => list.map((invoice) => invoice.id);
    expect([...ids(due.overdue), ...ids(due.dueIn7Days)]).not.toContain(overdue.id);
    expect(ids(due.dueIn7Days)).not.toContain(dueSoon.id);
    expect(ids(due.queried)).toContain(dueSoon.id);
  });

  test("rejects a date that does not exist with 400", async ({ request }) => {
    const response = await request.get("/api/payments/due?asOf=2026-13-01");

    expect(response.status()).toBe(400);
  });
});
