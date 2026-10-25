import { expect, test } from "./fixtures";

// The default test invoice bills August 2026 (1-31 Aug, 4 wks 1 day at £50.00 = £210.00) plus a
// 10% damage waiver of £21.00, for an order that started on Mon 3 Aug 2026.

test.describe("Reconciliation checks run when an invoice is saved", () => {
  test(
    "a correct invoice has no findings and is marked CHECKED",
    { tag: "@smoke" },
    async ({ api }) => {
      const invoice = await api.createInvoice(await api.createOrder());

      expect(invoice.checkStatus).toBe("CHECKED");
      expect(invoice.findings).toEqual([]);
    },
  );

  test(
    "R1: an invoice billed past the off-hire date returns the overcharge",
    { tag: "@smoke" },
    async ({ api }) => {
      const order = await api.createOrder();
      await api.offHire(order.id, { offHireDate: "2026-08-12" });

      const invoice = await api.createInvoice(order);

      expect(invoice.findings).toEqual([
        expect.objectContaining({
          check: "R1",
          severity: "HIGH",
          invoiceLineId: invoice.lines[0].id,
          linePosition: 1,
          message: `Job ${order.supplierJobNo} was off-hired on 2026-08-12 but billed to 2026-08-31: 13 working days charged after off-hire`,
          billed: 210,
          expected: 80,
          difference: 130,
          resolved: false,
        }),
      ]);
    },
  );

  test("R1: entering the off-hire date later re-checks the order's invoices", async ({ api }) => {
    const order = await api.createOrder();
    const invoice = await api.createInvoice(order);
    expect(invoice.findings).toEqual([]);

    await api.offHire(order.id, { offHireDate: "2026-08-12" });

    const rechecked = await api.getInvoice(invoice.id);
    expect(rechecked.findings.map((f) => f.check)).toEqual(["R1"]);
  });

  test("R1: a credit note for the overcharge closes the finding on the original invoice", async ({
    api,
  }) => {
    const order = await api.createOrder();
    await api.offHire(order.id, { offHireDate: "2026-08-12" });
    const original = await api.createInvoice(order);

    const credit = await api.createInvoice(order, {
      type: "RETURN",
      isCreditNote: true,
      date: "2026-09-10",
      net: -143,
      vat: -28.6,
      gross: -171.6,
      lines: [
        {
          description: "Credit: off hired 12/08",
          fleetCode: order.items[0].fleetCode,
          periodFrom: "2026-08-31",
          periodTo: "2026-08-13",
          weeks: 2,
          days: 3,
          rate: 50,
          chargeType: "HIRE",
          net: -130,
          vat: -26,
        },
        { description: "Damage waiver credit", chargeType: "DAMAGE_WAIVER", net: -13, vat: -2.6 },
      ],
    });

    const rechecked = await api.getInvoice(original.id);
    expect(rechecked.findings).toEqual([
      expect.objectContaining({
        check: "R1",
        resolved: true,
        resolution: `Credited on ${credit.number}`,
      }),
    ]);
  });

  test("R5: a line billed above the agreed rate", async ({ api }) => {
    const order = await api.createOrder();

    const invoice = await api.createInvoice(order, {
      net: 239.8,
      vat: 47.96,
      gross: 287.76,
      lines: [
        {
          description: "Scissor lift",
          fleetCode: order.items[0].fleetCode,
          periodFrom: "2026-08-01",
          periodTo: "2026-08-31",
          chargeType: "HIRE",
          net: 218,
          vat: 43.6,
        },
        { description: "Damage waiver", chargeType: "DAMAGE_WAIVER", net: 21.8, vat: 4.36 },
      ],
    });

    expect(invoice.findings).toEqual([
      expect.objectContaining({
        check: "R5",
        message: "Billed £218.00, expected £210.00 for 4 wks 1 day at £50.00/week",
        difference: 8,
      }),
    ]);
  });

  test("R10: header totals that do not add up", async ({ api }) => {
    const invoice = await api.createInvoice(await api.createOrder(), { gross: 300 });

    expect(invoice.findings).toEqual([
      expect.objectContaining({
        check: "R10",
        invoiceLineId: null,
        message: "Gross £300.00 is not net + VAT, £277.20",
      }),
    ]);
  });

  test("R13: a damage waiver that is not 10% of the hire", async ({ api }) => {
    const order = await api.createOrder();

    const invoice = await api.createInvoice(order, {
      net: 235,
      vat: 47,
      gross: 282,
      lines: [
        {
          description: "Scissor lift",
          fleetCode: order.items[0].fleetCode,
          periodFrom: "2026-08-01",
          periodTo: "2026-08-31",
          chargeType: "HIRE",
          net: 210,
          vat: 42,
        },
        { description: "Damage waiver", chargeType: "DAMAGE_WAIVER", net: 25, vat: 5 },
      ],
    });

    expect(invoice.findings.map((f) => [f.check, f.difference])).toEqual([["R13", 4]]);
  });
});

test.describe("POST /api/invoices/:id/check", () => {
  test("runs the checks again and returns the findings", async ({ request, api }) => {
    const order = await api.createOrder();
    await api.offHire(order.id, { offHireDate: "2026-08-12" });
    const invoice = await api.createInvoice(order);

    const response = await request.post(`/api/invoices/${invoice.id}/check`);

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(
      invoice.findings.map((f) => ({ ...f, id: expect.any(String) })),
    );
  });

  test("returns 404 for an invoice that does not exist", async ({ request }) => {
    const response = await request.post("/api/invoices/does-not-exist/check");

    expect(response.status()).toBe(404);
  });
});

test.describe("GET /api/invoices", () => {
  test("counts the open findings of each invoice", async ({ request, api }) => {
    const order = await api.createOrder();
    await api.offHire(order.id, { offHireDate: "2026-08-12" });
    const invoice = await api.createInvoice(order);

    const response = await request.get(`/api/invoices?supplierId=${order.supplier.id}`);

    expect(await response.json()).toEqual([
      expect.objectContaining({ id: invoice.id, openFindingCount: 1, highFindingCount: 1 }),
    ]);
  });
});
