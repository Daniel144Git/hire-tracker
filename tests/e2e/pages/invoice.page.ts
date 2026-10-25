import type { Locator, Page } from "@playwright/test";

/** Page Object for one invoice ("/invoices/:id"): its header and lines. */
export class InvoicePage {
  readonly heading: Locator;
  readonly linesTable: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1 });
    this.linesTable = page.getByRole("table", { name: "Invoice lines" });
  }

  async goto(invoiceId: string): Promise<void> {
    await this.page.goto(`/invoices/${invoiceId}`);
  }

  /**
   * A value of the header, e.g. headerValue("Due date"). A term/value pair has no role with a
   * name to find it by, so each value carries a test id: "invoice-due-date".
   */
  headerValue(term: string): Locator {
    return this.page.getByTestId(`invoice-${term.toLowerCase().replaceAll(" ", "-")}`);
  }

  /** The "Linked to" cell of a line, by its line number. */
  linkedTo(lineNumber: number): Locator {
    return this.linesTable
      .getByRole("row")
      .filter({ has: this.page.getByRole("rowheader", { name: String(lineNumber), exact: true }) })
      .getByRole("cell")
      .last();
  }
}
