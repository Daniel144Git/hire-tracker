import { test as base } from "@playwright/test";
import { HomePage } from "./pages/home.page";

type PageObjects = {
  homePage: HomePage;
};

/**
 * Extends Playwright's `test` so every test can ask for a ready-made page object
 * by name, e.g. `async ({ homePage }) => ...`, instead of constructing it itself.
 */
export const test = base.extend<PageObjects>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
});

export { expect } from "@playwright/test";
