import { uniqueCode } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("Reconciliation findings", () => {
  test(
    "off-hire an item on the site page, then the next invoice is flagged for the days after",
    { tag: "@smoke" },
    async ({ sitePage, invoiceFormPage, invoicePage, api }) => {
      const order = await api.createOrder({ overrides: { startDate: "2026-08-03" } });
      await sitePage.goto(order.site.id);
      await sitePage.offHire(order.supplierJobNo, "2026-08-12");
      await expect(sitePage.cell(order.supplierJobNo, "Status")).toHaveText("Off hired");

      await invoiceFormPage.goto();
      await invoiceFormPage.enterInvoice({
        supplierName: order.supplier.name,
        number: `INV-${uniqueCode(8)}`,
        type: "Continuation",
        date: "2026-08-31",
        jobNo: order.supplierJobNo,
        net: 231,
        vat: 46.2,
        gross: 277.2,
        lines: [
          {
            description: "Scissor lift 19ft electric",
            chargeType: "Hire",
            fleetCode: order.items[0].fleetCode ?? "",
            periodFrom: "2026-08-01",
            periodTo: "2026-08-31",
            weeks: 4,
            days: 1,
            rate: 50,
            net: 210,
            vat: 42,
          },
          { description: "Damage waiver 10%", chargeType: "Damage waiver", net: 21, vat: 4.2 },
        ],
      });

      await expect(invoicePage.findingsSummary).toHaveText(
        "1 open finding, 1 high. Overcharged: £130.00.",
      );
      await expect(invoicePage.findingCell("R1", "Severity")).toHaveText("High");
      await expect(invoicePage.findingCell("R1", "Line")).toHaveText("1");
      await expect(invoicePage.findingCell("R1", "Finding")).toHaveText(
        `Job ${order.supplierJobNo} was off-hired on 2026-08-12 but billed to 2026-08-31: 13 working days charged after off-hire`,
      );
      await expect(invoicePage.findingCell("R1", "Billed")).toHaveText("£210.00");
      await expect(invoicePage.findingCell("R1", "Expected")).toHaveText("£80.00");
      await expect(invoicePage.findingCell("R1", "Difference")).toHaveText("£130.00");
      await expect(invoicePage.findingCell("R1", "Status")).toHaveText("Open");
    },
  );

  test("shows a finding as credited once a credit note covers it", async ({ invoicePage, api }) => {
    const order = await api.createOrder();
    await api.offHire(order.id, { offHireDate: "2026-08-12" });
    const original = await api.createInvoice(order);
    const credit = await api.createInvoice(order, {
      type: "RETURN",
      isCreditNote: true,
      net: -130,
      vat: -26,
      gross: -156,
      lines: [
        {
          description: "Credit",
          fleetCode: order.items[0].fleetCode,
          periodFrom: "2026-08-31",
          periodTo: "2026-08-13",
          chargeType: "HIRE",
          net: -130,
          vat: -26,
        },
      ],
    });

    await invoicePage.goto(original.id);

    await expect(invoicePage.findingCell("R1", "Status")).toHaveText(
      `Credited on ${credit.number}`,
    );
    await expect(invoicePage.findingsSummary).toHaveText("0 open findings. 1 resolved.");
  });

  test("says there are no discrepancies when the invoice matches the order", async ({
    invoicePage,
    api,
  }) => {
    const invoice = await api.createInvoice(await api.createOrder());

    await invoicePage.goto(invoice.id);

    await expect(invoicePage.findingsSummary).toHaveText(
      "No discrepancies found: this invoice matches the orders.",
    );
    await expect(invoicePage.findingsTable).toHaveCount(0);
  });

  test("the invoice list shows how many findings are open", async ({ invoicesPage, api }) => {
    const order = await api.createOrder();
    await api.offHire(order.id, { offHireDate: "2026-08-12" });
    const invoice = await api.createInvoice(order);

    await invoicesPage.goto();

    await expect(invoicesPage.openFindings(invoice.number)).toHaveText("1 (1 high)");
  });

  test("an invoice with findings has no accessibility violations", async ({
    invoicePage,
    api,
    checkAccessibility,
  }) => {
    const order = await api.createOrder();
    await api.offHire(order.id, { offHireDate: "2026-08-12" });
    const invoice = await api.createInvoice(order, { gross: 300 });

    await invoicePage.goto(invoice.id);
    await expect(invoicePage.findingsTable).toBeVisible();

    await checkAccessibility();
  });
});
