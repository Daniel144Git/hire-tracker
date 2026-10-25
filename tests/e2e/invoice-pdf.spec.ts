import { despatchInvoice, pdfOf } from "../support/invoice-documents";
import { uniqueCode } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("Reading an invoice PDF", () => {
  test(
    "fills the invoice form from a PDF, and the saved invoice keeps the PDF",
    { tag: "@smoke" },
    async ({ invoiceFormPage, invoicePage, api, checkAccessibility }) => {
      const accountNo = `ACC-${uniqueCode(6)}`;
      const supplier = await api.createSupplier({ accountNo });
      const number = uniqueCode(8);
      await invoiceFormPage.goto();

      await invoiceFormPage.readPdf(
        `${number}.pdf`,
        await pdfOf(despatchInvoice({ accountNo, number })),
      );

      await expect(invoiceFormPage.pdfMessage).toHaveText(
        `Read invoice ${number} from ${supplier.name}. Check every field below, then save it.`,
      );
      await expect(invoiceFormPage.supplierSelect).toHaveValue(supplier.id);
      await expect(invoiceFormPage.numberInput).toHaveValue(number);
      await expect(invoiceFormPage.line(1).getByLabel("Fleet code")).toHaveValue("APX-SL-0042");
      await expect(invoiceFormPage.line(2).getByLabel("Description")).toHaveValue("Damage Waiver");
      await expect(invoiceFormPage.warnings).toHaveCount(0);
      await checkAccessibility();

      await invoiceFormPage.saveButton.click();

      await expect(invoicePage.heading).toHaveText(`Invoice ${number}`);
      await expect(invoicePage.pdfLink).toHaveAttribute("href", /^\/api\/invoices\/[^/]+\/file$/);
    },
  );

  test("lists what to check when the PDF does not add up", async ({ invoiceFormPage }) => {
    const document = despatchInvoice({ accountNo: `NONE-${uniqueCode(6)}` }).replace(
      "GOODS      554.40",
      "GOODS      560.00",
    );
    await invoiceFormPage.goto();

    await invoiceFormPage.readPdf("invoice.pdf", await pdfOf(document));

    await expect(invoiceFormPage.warnings).toHaveText([
      "The lines add up to £554.40 but the net total printed is £560.00: check the lines.",
      /^No supplier has account number NONE-/,
    ]);
    await expect(invoiceFormPage.supplierSelect).toHaveValue("");
  });

  test("says why a file cannot be read", async ({ invoiceFormPage }) => {
    await invoiceFormPage.goto();

    await invoiceFormPage.readPdf("notes.pdf", new TextEncoder().encode("not a pdf"));

    await expect(invoiceFormPage.pdfMessage).toHaveText("The file is not a PDF");
  });
});
