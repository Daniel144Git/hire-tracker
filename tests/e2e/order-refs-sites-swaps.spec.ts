import { itemData, julyLine, uniqueCode } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("Our order number, site spellings and fleet code changes", () => {
  test(
    "an invoice entered with our order number links to the order and takes its site",
    { tag: "@smoke" },
    async ({ invoiceFormPage, invoicePage, api }) => {
      const order = await api.createOrder();
      await invoiceFormPage.goto();

      await invoiceFormPage.enterInvoice({
        supplierName: order.supplier.name,
        number: `INV-${uniqueCode(8)}`,
        type: "Continuation",
        date: "2026-08-31",
        orderRef: order.orderRef ?? "",
        net: 21,
        vat: 4.2,
        gross: 25.2,
        lines: [
          { description: "Damage waiver 10%", chargeType: "Damage waiver", net: 21, vat: 4.2 },
        ],
      });

      await expect(invoicePage.headerValue("Site")).toHaveText(
        `${order.site.code} - ${order.site.name} (from the linked order)`,
      );
      await expect(invoicePage.linkedTo(1)).toContainText(order.supplierJobNo);
    },
  );

  test("a spelling saved on the site page recognises an invoice that has no order", async ({
    sitePage,
    invoicePage,
    api,
    page,
  }) => {
    const site = await api.createSite();
    const supplier = await api.createSupplier();
    const spelling = `Tower ${uniqueCode(5)}`;
    await sitePage.goto(site.id);

    await sitePage.saveSpellings([spelling]);
    await expect(page.getByRole("status")).toHaveText(`Saved 1 spelling for ${site.code}`);

    const invoice = await api.createInvoiceForSupplier(supplier, {
      customerRef: spelling.toLowerCase(),
      lines: [{ description: "Delivery", chargeType: "TRANSPORT", net: 231, vat: 46.2 }],
    });
    await invoicePage.goto(invoice.id);
    await expect(invoicePage.headerValue("Site")).toHaveText(
      `${site.code} - ${site.name} (recognised from a recorded spelling)`,
    );
  });

  test("recording the new fleet code of a swapped item clears the swap findings", async ({
    sitePage,
    invoicePage,
    api,
  }) => {
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
        julyLine(groover.fleetCode, { description: "Pipe groover 2-6in", net: 189.93, vat: 37.99 }),
      ],
    });
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
    await sitePage.goto(order.site.id);

    await sitePage.recordNewFleetCode({
      item: `${order.supplierJobNo}: Pipe groover 2-6in (${groover.fleetCode})`,
      newCode,
      changedOn: "2026-08-01",
    });

    await expect(sitePage.cell(order.supplierJobNo, "Items")).toContainText(
      `(${newCode}) £41.29/wk (was ${groover.fleetCode})`,
    );
    await invoicePage.goto(august.id);
    await expect(invoicePage.finding("R15")).toHaveCount(0);
    await expect(invoicePage.finding("R8")).toHaveCount(0);
  });
});
