import { invoiceData } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("POST /api/invoices", () => {
  test(
    "records an invoice and links its lines to the order and item",
    { tag: "@smoke" },
    async ({ request, api }) => {
      const order = await api.createOrder();
      const data = invoiceData({
        supplierId: order.supplier.id,
        jobNo: order.supplierJobNo.toLowerCase(),
        fleetCode: order.items[0].fleetCode,
      });

      const response = await request.post("/api/invoices", { data });

      expect(response.status()).toBe(201);
      const invoice = await response.json();
      expect(invoice).toMatchObject({
        number: data.number,
        supplier: { id: order.supplier.id },
        date: "2026-08-31",
        dueDate: "2026-09-30",
        type: "CONTINUATION",
        jobNo: order.supplierJobNo,
        net: 231,
        vat: 46.2,
        gross: 277.2,
        // The reconciliation checks run as soon as an invoice is saved.
        checkStatus: "CHECKED",
        paymentStatus: "UNPAID",
      });
      expect(invoice.lines).toEqual([
        expect.objectContaining({
          position: 1,
          chargeType: "HIRE",
          net: 210,
          order: expect.objectContaining({
            id: order.id,
            site: expect.objectContaining({ id: order.site.id }),
          }),
          hireItem: expect.objectContaining({ id: order.items[0].id }),
          linkProblem: null,
        }),
        expect.objectContaining({
          position: 2,
          chargeType: "DAMAGE_WAIVER",
          order: expect.objectContaining({ id: order.id }),
          hireItem: null,
          linkProblem: null,
        }),
      ]);
    },
  );

  test("calculates the due date from NET_N payment terms", async ({ api }) => {
    const supplier = await api.createSupplier({ paymentTerms: "NET_N", paymentTermsDays: 30 });
    const order = await api.createOrder({ supplier, overrides: { startDate: "2026-12-01" } });

    const invoice = await api.createInvoice(order, { date: "2026-12-15" });

    expect(invoice.dueDate).toBe("2027-01-14");
  });

  test("keeps the due date printed on the invoice when it is given", async ({ api }) => {
    const order = await api.createOrder();

    const invoice = await api.createInvoice(order, { dueDate: "2026-09-15" });

    expect(invoice.dueDate).toBe("2026-09-15");
  });

  test("records a line whose fleet code is on no order, and says why it is not linked", async ({
    api,
  }) => {
    const order = await api.createOrder();

    const invoice = await api.createInvoice(order, {
      lines: [
        {
          description: "Scissor lift 26ft",
          fleetCode: "APX-ZZ-0000",
          chargeType: "HIRE",
          net: 100,
          vat: 20,
        },
      ],
    });

    expect(invoice.lines[0]).toMatchObject({
      order: { id: order.id },
      hireItem: null,
      linkProblem: "UNKNOWN_FLEET_CODE",
    });
  });

  test("records an invoice for a job number with no order, and flags its lines", async ({
    api,
  }) => {
    const order = await api.createOrder();

    const invoice = await api.createInvoice(order, { jobNo: "J0000000" });

    expect(invoice.lines.map((line) => line.linkProblem)).toEqual([null, "UNKNOWN_JOB_NO"]);
    expect(invoice.lines[0].hireItem?.id).toBe(order.items[0].id);
  });

  test("rejects an invoice number already recorded for the supplier, with 409", async ({
    request,
    api,
  }) => {
    const order = await api.createOrder();
    const existing = await api.createInvoice(order);

    const response = await request.post("/api/invoices", {
      data: invoiceData(
        { supplierId: order.supplier.id, jobNo: order.supplierJobNo },
        { number: existing.number.toLowerCase() },
      ),
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toMatchObject({
      code: "DUPLICATE_INVOICE",
      message: `Invoice ${existing.number} from ${order.supplier.name} is already recorded`,
    });
  });

  test("accepts the same invoice number from a different supplier", async ({ api }) => {
    const existing = await api.createInvoice(await api.createOrder());

    const invoice = await api.createInvoice(await api.createOrder(), { number: existing.number });

    expect(invoice.number).toBe(existing.number);
  });

  test("records a credit note with negative amounts and a period printed backwards", async ({
    api,
  }) => {
    const order = await api.createOrder();

    const credit = await api.createInvoice(order, {
      type: "RETURN",
      isCreditNote: true,
      net: -33,
      vat: -6.6,
      gross: -39.6,
      lines: [
        {
          description: "Credit: off hired 27/08",
          fleetCode: order.items[0].fleetCode,
          periodFrom: "2026-08-31",
          periodTo: "2026-08-27",
          days: 3,
          rate: 50,
          chargeType: "HIRE",
          net: -30,
          vat: -6,
        },
        { description: "Damage waiver credit", chargeType: "DAMAGE_WAIVER", net: -3, vat: -0.6 },
      ],
    });

    expect(credit).toMatchObject({ isCreditNote: true, gross: -39.6 });
    expect(credit.lines[0]).toMatchObject({
      periodFrom: "2026-08-31",
      periodTo: "2026-08-27",
      net: -30,
    });
  });

  test("stores totals as printed even when they do not add up", async ({ api }) => {
    const order = await api.createOrder();

    const invoice = await api.createInvoice(order, { gross: 300 });

    expect(invoice.gross).toBe(300);
  });

  test("rejects an unknown supplier with 400 on supplierId", async ({ request }) => {
    const response = await request.post("/api/invoices", {
      data: invoiceData({ supplierId: "no-such-supplier" }),
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.issues).toEqual([
      { path: ["supplierId"], message: "Supplier not found" },
    ]);
  });

  test("reports an invalid line amount with its full path", async ({ request, api }) => {
    const supplier = await api.createSupplier();
    const data = invoiceData({ supplierId: supplier.id });
    data.lines[1] = { ...data.lines[1], net: 21.005 };

    const response = await request.post("/api/invoices", { data });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.issues).toEqual([
      { path: ["lines", 1, "net"], message: "Must have at most 2 decimal places" },
    ]);
  });
});

test.describe("GET /api/invoices", () => {
  test("lists a supplier's invoices with how many lines are not linked", async ({
    request,
    api,
  }) => {
    const order = await api.createOrder();
    const invoice = await api.createInvoice(order, { jobNo: "J0000000" });
    await api.createInvoice(await api.createOrder());

    const response = await request.get(`/api/invoices?supplierId=${order.supplier.id}`);

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual([
      expect.objectContaining({ id: invoice.id, lineCount: 2, unlinkedLineCount: 1 }),
    ]);
  });

  test("filters by job number", async ({ request, api }) => {
    const order = await api.createOrder();
    const invoice = await api.createInvoice(order);

    const response = await request.get(`/api/invoices?jobNo=${order.supplierJobNo}`);

    expect((await response.json()).map((i: { id: string }) => i.id)).toEqual([invoice.id]);
  });

  test("returns one invoice with its lines", async ({ request, api }) => {
    const invoice = await api.createInvoice(await api.createOrder());

    const response = await request.get(`/api/invoices/${invoice.id}`);

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(invoice);
  });

  test("returns 404 for an invoice that does not exist", async ({ request }) => {
    const response = await request.get("/api/invoices/does-not-exist");

    expect(response.status()).toBe(404);
  });
});
