import type { Locator, Page } from "@playwright/test";

/** Page Object for the list of sites ("/sites") and its "Add a site" form. */
export class SitesPage {
  readonly heading: Locator;
  readonly sitesTable: Locator;
  readonly codeInput: Locator;
  readonly nameInput: Locator;
  readonly addressInput: Locator;
  readonly addButton: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1, name: "Sites" });
    this.sitesTable = page.getByRole("table", { name: "Sites" });
    this.codeInput = page.getByLabel("Code");
    this.nameInput = page.getByLabel("Name");
    this.addressInput = page.getByLabel("Delivery address");
    this.addButton = page.getByRole("button", { name: "Add site" });
    this.successMessage = page.getByRole("status");
    this.errorMessage = page.getByRole("alert");
  }

  async goto(): Promise<void> {
    await this.page.goto("/sites");
  }

  /** The table row of a site, found by its code. */
  row(code: string): Locator {
    return this.sitesTable
      .getByRole("row")
      .filter({ has: this.page.getByRole("link", { name: code }) });
  }

  async addSite(site: { code: string; name: string; deliveryAddress?: string }): Promise<void> {
    await this.codeInput.fill(site.code);
    await this.nameInput.fill(site.name);
    if (site.deliveryAddress) await this.addressInput.fill(site.deliveryAddress);
    await this.addButton.click();
  }

  async openSite(code: string): Promise<void> {
    await this.sitesTable.getByRole("link", { name: code }).click();
  }
}
