import type { Locator, Page } from "@playwright/test";

/**
 * Page Object for the home page ("/").
 * It knows HOW to find things on the page. The tests decide WHAT to assert.
 */
export class HomePage {
  readonly heading: Locator;
  readonly checksSection: Locator;
  readonly checks: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1, name: "Hire Tracker" });
    this.checksSection = page.getByRole("region", { name: "What it checks" });
    this.checks = this.checksSection.getByRole("listitem");
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
  }
}
