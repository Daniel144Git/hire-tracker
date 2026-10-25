import { expect, test } from "./fixtures";

test.describe("Home page", () => {
  test(
    "shows the app name and the invoice checks it runs",
    { tag: "@smoke" },
    async ({ page, homePage }) => {
      await homePage.goto();

      await expect(page).toHaveTitle("Hire Tracker");
      await expect(homePage.heading).toBeVisible();
      await expect(homePage.checks).toHaveCount(4);
      await expect(homePage.checks.first()).toHaveText("Items billed after they went off hire");
    },
  );
});
