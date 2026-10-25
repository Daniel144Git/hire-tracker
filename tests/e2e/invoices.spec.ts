import { uniqueCode } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("Invoices", () => {
  test(
    "enters an invoice by hand and sees each line linked to the hire order",
    { tag: "@smoke" },
    async ({ page, invoiceFormPage, invoicePage, api }) => {
      const order = await api.createOrder();
      const number = `INV-${uniqueCode(8)}`;
      const fleetCode = order.items[0].fleetCode ?? "";
      await invoiceFormPage.goto();

      await invoiceFormPage.enterInvoice({
        supplierName: order.supplier.name,
        number,
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
            fleetCode,
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

      await expect(page).toHaveURL(/\/invoices\/(?!new)[^/]+$/);
      await expect(invoicePage.heading).toHaveText(`Invoice ${number}`);
      await expect(invoicePage.headerValue("Due date")).toHaveText("2026-09-30");
      await expect(invoicePage.linkedTo(1)).toHaveText(
        `${order.supplierJobNo} (${order.site.code}) ${fleetCode}`,
      );
      await expect(invoicePage.linkedTo(2)).toHaveText(
        `${order.supplierJobNo} (${order.site.code})`,
      );
    },
  );

  test("refuses an invoice number already recorded and keeps what was typed", async ({
    invoiceFormPage,
    api,
  }) => {
    const order = await api.createOrder();
    const existing = await api.createInvoice(order);
    await invoiceFormPage.goto();

    await invoiceFormPage.enterInvoice({
      supplierName: order.supplier.name,
      number: existing.number,
      type: "Continuation",
      date: "2026-08-31",
      jobNo: order.supplierJobNo,
      net: 21,
      vat: 4.2,
      gross: 25.2,
      lines: [{ description: "Damage waiver 10%", chargeType: "Damage waiver", net: 21, vat: 4.2 }],
    });

    await expect(invoiceFormPage.numberInput).toHaveAccessibleDescription(
      `Invoice ${existing.number} from ${order.supplier.name} is already recorded`,
    );
    await expect(invoiceFormPage.line(1).getByLabel("Description")).toHaveValue(
      "Damage waiver 10%",
    );
  });

  test("shows which field of which line is wrong", async ({ invoiceFormPage, api }) => {
    const order = await api.createOrder();
    await invoiceFormPage.goto();

    await invoiceFormPage.enterInvoice({
      supplierName: order.supplier.name,
      number: `INV-${uniqueCode(8)}`,
      type: "Continuation",
      date: "2026-08-31",
      net: 231,
      vat: 46.2,
      gross: 277.2,
      lines: [
        { description: "Hire", chargeType: "Hire", net: 210, vat: 42 },
        { description: "Damage waiver", chargeType: "Damage waiver", net: 21.005, vat: 4.2 },
      ],
    });

    await expect(invoiceFormPage.line(2).getByLabel("Net (£)")).toHaveAccessibleDescription(
      "Must have at most 2 decimal places",
    );
    await expect(invoiceFormPage.line(1).getByLabel("Net (£)")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("removes a line before saving", async ({ invoiceFormPage }) => {
    await invoiceFormPage.goto();
    await invoiceFormPage.addLineButton.click();
    await invoiceFormPage.addLineButton.click();
    await invoiceFormPage.line(3).getByLabel("Description").fill("Third line");

    await invoiceFormPage.form.getByRole("button", { name: "Remove line 2" }).click();

    await expect(invoiceFormPage.line(3)).toHaveCount(0);
    await expect(invoiceFormPage.line(2).getByLabel("Description")).toHaveValue("Third line");
  });

  test("flags a line whose fleet code is on no hire order", async ({ invoicePage, api }) => {
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

    await invoicePage.goto(invoice.id);

    await expect(invoicePage.linkedTo(1)).toContainText("Fleet code not on any order");
  });

  test("lists invoices with the number of lines that are not linked", async ({
    invoicesPage,
    api,
  }) => {
    const invoice = await api.createInvoice(await api.createOrder(), { jobNo: "J0000000" });

    await invoicesPage.goto();

    await expect(invoicesPage.unlinkedLines(invoice.number)).toHaveText("1");
  });

  test("has no accessibility violations on the invoice form and an invoice", async ({
    invoiceFormPage,
    invoicePage,
    api,
    checkAccessibility,
  }) => {
    const invoice = await api.createInvoice(await api.createOrder());

    await invoiceFormPage.goto();
    await expect(invoiceFormPage.saveButton).toBeVisible();
    await checkAccessibility();

    await invoicePage.goto(invoice.id);
    await expect(invoicePage.linesTable).toBeVisible();
    await checkAccessibility();
  });
});
