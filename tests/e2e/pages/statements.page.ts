import type { Locator, Page } from "@playwright/test";

/** Page Object for "/statements" and one statement ("/statements/:id"). */
export class StatementsPage {
  readonly importMessage: Locator;
  readonly heading: Locator;
  readonly summary: Locator;
  readonly problemsTable: Locator;
  readonly linesTable: Locator;
  readonly markPaidButton: Locator;
  readonly markPaidMessage: Locator;

  constructor(private readonly page: Page) {
    const importSection = page.getByRole("region", { name: "Import a statement" });
    this.importMessage = importSection.getByRole("alert");
    this.heading = page.getByRole("heading", { level: 1 });
    this.summary = page.getByTestId("statement-summary");
    this.problemsTable = page.getByRole("table", { name: "Problems" });
    this.linesTable = page.getByRole("table", { name: "Statement lines" });
    this.markPaidButton = page.getByRole("button", { name: /^Mark the \d+ invoices? not on/ });
    this.markPaidMessage = page.getByRole("main").getByRole("status");
  }

  async goto(): Promise<void> {
    await this.page.goto("/statements");
  }

  async importPdf(name: string, pdf: Uint8Array): Promise<void> {
    const importSection = this.page.getByRole("region", { name: "Import a statement" });
    await importSection.getByLabel("Statement PDF").setInputFiles({
      name,
      mimeType: "application/pdf",
      buffer: Buffer.from(pdf),
    });
    await importSection.getByRole("button", { name: "Import statement" }).click();
  }

  /** The row of a problem, by invoice number. */
  problem(invoiceNo: string): Locator {
    return this.problemsTable
      .getByRole("row")
      .filter({ has: this.page.getByRole("rowheader", { name: invoiceNo, exact: true }) });
  }
}
