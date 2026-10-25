import type { Locator, Page } from "@playwright/test";

/** Page Object for the monthly discrepancy report ("/reports/discrepancies"). */
export class DiscrepancyReportPage {
  readonly heading: Locator;
  readonly monthInput: Locator;
  readonly showButton: Locator;
  /** "2 invoices dated 2026-08: 3 open findings, 1 high, overcharged £130.00." */
  readonly summary: Locator;
  readonly findingsTable: Locator;
  readonly missingPeriodsTable: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1, name: "Discrepancy report" });
    this.monthInput = page.getByLabel("Month", { exact: true });
    this.showButton = page.getByRole("button", { name: "Show" });
    this.summary = page.getByTestId("report-summary");
    this.findingsTable = page.getByRole("table", { name: "Findings of the month" });
    this.missingPeriodsTable = page.getByRole("table", { name: "Orders on hire with no invoice" });
  }

  async goto(month?: string): Promise<void> {
    await this.page.goto(
      month ? `/reports/discrepancies?month=${month}` : "/reports/discrepancies",
    );
  }

  async showMonth(month: string): Promise<void> {
    await this.monthInput.fill(month);
    await this.showButton.click();
  }

  /** The rows of one invoice's findings, found by the invoice number link. */
  invoiceRows(invoiceNumber: string): Locator {
    return this.findingsTable
      .getByRole("row")
      .filter({ has: this.page.getByRole("link", { name: invoiceNumber, exact: true }) });
  }

  missingPeriodRow(jobNo: string): Locator {
    return this.missingPeriodsTable
      .getByRole("row")
      .filter({ has: this.page.getByRole("rowheader", { name: jobNo, exact: true }) });
  }
}
