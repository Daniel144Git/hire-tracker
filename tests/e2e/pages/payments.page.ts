import type { Locator, Page } from "@playwright/test";

type Group = "Overdue" | "Due in the next 7 days" | "Due in 8 to 14 days" | "Due later" | "Queried";

/** Page Object for "/payments": invoices to pay grouped by due date. */
export class PaymentsPage {
  readonly heading: Locator;
  readonly summary: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1, name: "Payments" });
    this.summary = page.getByTestId("payments-summary");
  }

  async goto(): Promise<void> {
    await this.page.goto("/payments");
  }

  /** A group of invoices, e.g. group("Overdue"). Its heading also shows the count and total. */
  group(name: Group): Locator {
    return this.page.getByRole("region", { name: new RegExp(`^${name}`) });
  }

  invoiceRow(group: Group, invoiceNumber: string): Locator {
    return this.group(group)
      .getByRole("row")
      .filter({ has: this.page.getByRole("link", { name: invoiceNumber, exact: true }) });
  }

  async setStatus(
    invoiceNumber: string,
    action: "Mark paid" | "Query" | "Back to unpaid",
  ): Promise<void> {
    await this.page.getByRole("button", { name: `${action}: ${invoiceNumber}` }).click();
  }
}
