import type { Locator, Page } from "@playwright/test";

/** Page Object for "/reports/costs" and "/reports/yearly". */
export class CostsPage {
  readonly summary: Locator;
  readonly costTable: Locator;
  readonly csvLink: Locator;
  readonly yearlyTable: Locator;

  constructor(private readonly page: Page) {
    this.summary = page.getByTestId("costs-summary");
    this.costTable = page.getByRole("table", { name: /^Net cost by site and trade/ });
    this.csvLink = page.getByRole("link", { name: "Download the lines (CSV)" });
    this.yearlyTable = page.getByRole("table", { name: /^Gross cost by site and month/ });
  }

  async goto(month: string): Promise<void> {
    await this.page.goto(`/reports/costs?month=${month}`);
  }

  async gotoYear(year: number): Promise<void> {
    await this.page.goto(`/reports/yearly?year=${year}`);
  }

  /** A site's row in the cost table, by its code. */
  siteRow(code: string): Locator {
    return this.costTable
      .getByRole("row")
      .filter({ has: this.page.getByRole("rowheader", { name: new RegExp(`^${code} - `) }) });
  }

  /** A site's row in the yearly table, by its code. */
  yearlyRow(code: string): Locator {
    return this.yearlyTable
      .getByRole("row")
      .filter({ has: this.page.getByRole("rowheader", { name: code, exact: true }) });
  }

  /** The collapsible list of a site's lines. */
  async openLines(code: string): Promise<Locator> {
    const details = this.page.getByRole("group").filter({ hasText: new RegExp(`^${code} - `) });
    await details.getByText(new RegExp(`^${code} - .*lines?$`)).click();
    return details.getByRole("table");
  }
}
