import { despatchStatement, pdfOf } from "../support/invoice-documents";
import { uniqueCode } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("Supplier statements", () => {
  test(
    "imports a statement PDF and shows what does not match our invoices",
    { tag: "@smoke" },
    async ({ page, statementsPage, api, checkAccessibility }) => {
      const accountNo = `ACC-${uniqueCode(6)}`;
      const supplier = await api.createSupplier({ accountNo });
      const held = await api.createInvoiceForSupplier(supplier, { number: uniqueCode(8) });
      const notListed = await api.createInvoiceForSupplier(supplier, { number: uniqueCode(8) });
      const neverReceived = uniqueCode(8);
      await statementsPage.goto();

      await statementsPage.importPdf(
        "statement.pdf",
        await pdfOf(
          despatchStatement({
            accountNo,
            rows: [
              ["31/08/2026", "170200345", held.number, "Riverside", 277.2],
              ["20/08/2026", "170200345", neverReceived, "Riverside", 336.19],
            ],
          }),
        ),
      );

      await expect(page).toHaveURL(/\/statements\/[^/]+$/);
      await expect(statementsPage.heading).toHaveText(
        `Statement of 2026-09-02 from ${supplier.name}`,
      );
      await expect(statementsPage.summary).toHaveText(
        "2 lines, 1 in Hire Tracker. 2 problems, 1 high. Total £613.39.",
      );
      await expect(statementsPage.problem(neverReceived)).toContainText("Not in Hire Tracker");
      await expect(statementsPage.problem(notListed.number)).toContainText("Not on the statement");
      await checkAccessibility();

      await statementsPage.markPaidButton.click();

      await expect(statementsPage.markPaidMessage).toHaveText("Marked 1 invoice as paid");
      await expect(statementsPage.problem(notListed.number)).toHaveCount(0);
      expect((await api.getInvoice(notListed.id)).paymentStatus).toBe("PAID");
    },
  );

  test("says why a statement cannot be imported", async ({ statementsPage }) => {
    await statementsPage.goto();

    await statementsPage.importPdf(
      "statement.pdf",
      await pdfOf(despatchStatement({ accountNo: `NONE-${uniqueCode(6)}` })),
    );

    await expect(statementsPage.importMessage).toHaveText(
      /^No supplier has account number NONE-\w+: add it to the supplier first$/,
    );
  });
});
