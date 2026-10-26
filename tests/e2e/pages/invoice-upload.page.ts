import type { Locator, Page } from "@playwright/test";

/** Page Object for "/invoices/upload" (many PDFs at once) and "/invoices/review" (to check). */
export class InvoiceUploadPage {
  readonly progress: Locator;
  readonly results: Locator;
  readonly toCheckTable: Locator;

  constructor(private readonly page: Page) {
    this.progress = page.getByTestId("upload-progress");
    this.results = page.getByRole("table", { name: "Uploaded files" });
    this.toCheckTable = page.getByRole("table", { name: "Invoices to check" });
  }

  async goto(): Promise<void> {
    await this.page.goto("/invoices/upload");
  }

  async upload(files: { name: string; pdf: Uint8Array }[]): Promise<void> {
    await this.page.getByLabel("Invoice PDFs").setInputFiles(
      files.map(({ name, pdf }) => ({
        name,
        mimeType: "application/pdf",
        buffer: Buffer.from(pdf),
      })),
    );
    await this.page.getByRole("button", { name: "Upload" }).click();
  }

  /** The result row of a file. */
  result(fileName: string): Locator {
    return this.results
      .getByRole("row")
      .filter({ has: this.page.getByRole("rowheader", { name: fileName, exact: true }) });
  }

  toCheck(fileName: string): Locator {
    return this.toCheckTable
      .getByRole("row")
      .filter({ has: this.page.getByRole("rowheader", { name: fileName, exact: true }) });
  }
}
