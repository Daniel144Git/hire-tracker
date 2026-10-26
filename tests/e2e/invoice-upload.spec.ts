import { despatchInvoice, pdfOf } from "../support/invoice-documents";
import { uniqueCode } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("Uploading many invoices", () => {
  test(
    "saves the clean ones, skips the recorded one and keeps the other to check",
    { tag: "@smoke" },
    async ({ page, invoiceUploadPage, invoiceFormPage, invoicePage, api, checkAccessibility }) => {
      const accountNo = `ACC-${uniqueCode(6)}`;
      const supplier = await api.createSupplier({ accountNo });
      const [clean, recorded, unknown] = [uniqueCode(8), uniqueCode(8), uniqueCode(8)];
      await api.createInvoiceForSupplier(supplier, { number: recorded });
      await invoiceUploadPage.goto();

      await invoiceUploadPage.upload([
        { name: `${clean}.pdf`, pdf: await pdfOf(despatchInvoice({ accountNo, number: clean })) },
        {
          name: `${recorded}.pdf`,
          pdf: await pdfOf(despatchInvoice({ accountNo, number: recorded })),
        },
        {
          name: `${unknown}.pdf`,
          pdf: await pdfOf(
            despatchInvoice({ accountNo: `NONE-${uniqueCode(6)}`, number: unknown }),
          ),
        },
      ]);

      await expect(invoiceUploadPage.progress).toHaveText(
        "3 files: 1 saved, 1 already recorded, 1 to check, 0 not read.",
      );
      await expect(invoiceUploadPage.result(`${clean}.pdf`)).toContainText("Saved");
      await expect(invoiceUploadPage.result(`${recorded}.pdf`)).toContainText("Already recorded");
      await expect(invoiceUploadPage.result(`${unknown}.pdf`)).toContainText("To check");
      await checkAccessibility();

      // The one to check opens in the form, with what could not be read marked.
      await invoiceUploadPage
        .result(`${unknown}.pdf`)
        .getByRole("link", { name: "Check and save" })
        .click();
      await expect(invoiceFormPage.numberInput).toHaveValue(unknown);
      await expect(invoiceFormPage.supplierSelect).toHaveAccessibleDescription(
        "Not recognised: choose the supplier",
      );
      await invoiceFormPage.supplierSelect.selectOption({ label: supplier.name });
      await invoiceFormPage.saveButton.click();

      await expect(invoicePage.heading).toHaveText(`Invoice ${unknown}`);
      await expect(invoicePage.pdfLink).toBeVisible();
      await page.goto("/invoices/review");
      await expect(invoiceUploadPage.toCheck(`${unknown}.pdf`)).toHaveCount(0);
    },
  );

  test("discards an invoice to check", async ({ page, invoiceUploadPage, request }) => {
    const fileName = `${uniqueCode(8)}.pdf`;
    await request.post("/api/invoices/import", {
      multipart: {
        file: {
          name: fileName,
          mimeType: "application/pdf",
          buffer: Buffer.from(await pdfOf(despatchInvoice({ accountNo: `NONE-${uniqueCode(6)}` }))),
        },
      },
    });
    await page.goto("/invoices/review");

    await invoiceUploadPage
      .toCheck(fileName)
      .getByRole("button", { name: `Discard ${fileName}` })
      .click();

    await expect(invoiceUploadPage.toCheck(fileName)).toHaveCount(0);
  });
});
