import type { Locator, Page } from "@playwright/test";

/** Page Object for the list of invoices ("/invoices"). */
export class InvoicesPage {
  readonly heading: Locator;
  readonly invoicesTable: Locator;
  readonly enterInvoiceLink: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1, name: "Invoices" });
    this.invoicesTable = page.getByRole("table", { name: "Invoices" });
    this.enterInvoiceLink = page.getByRole("link", { name: "Enter an invoice" });
  }

  async goto(): Promise<void> {
    await this.page.goto("/invoices");
  }

  row(number: string): Locator {
    return this.invoicesTable
      .getByRole("row")
      .filter({ has: this.page.getByRole("link", { name: number, exact: true }) });
  }

  /** The "Lines not linked" count of an invoice. */
  unlinkedLines(number: string): Locator {
    return this.row(number).getByRole("cell").last();
  }
}
