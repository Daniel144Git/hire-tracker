import { expect, test } from "./fixtures";

const html = (page: import("@playwright/test").Page) => page.locator("html");

test.describe("Dark mode", () => {
  test("switches to dark and keeps it after a reload", { tag: "@smoke" }, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await expect(html(page)).toHaveAttribute("data-theme", "light");

    await page.getByLabel("Theme").selectOption({ label: "Dark" });

    await expect(html(page)).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(10, 10, 10)");
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "dark");
    await expect(page.getByLabel("Theme")).toHaveValue("dark");
  });

  test("follows the system until a theme is chosen", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(html(page)).toHaveAttribute("data-theme", "dark");

    await page.emulateMedia({ colorScheme: "light" });
    await expect(html(page)).toHaveAttribute("data-theme", "light");

    await page.getByLabel("Theme").selectOption({ label: "Dark" });
    await page.emulateMedia({ colorScheme: "light" });
    await expect(html(page)).toHaveAttribute("data-theme", "dark");
  });

  // axe checks colour contrast too, so every main page is scanned in the dark theme.
  for (const path of [
    "/",
    "/sites",
    "/invoices",
    "/invoices/new",
    "/invoices/upload",
    "/reports/discrepancies?month=2026-08",
    "/reports/costs?month=2026-08",
    "/reports/yearly?year=2026",
    "/payments",
    "/statements",
    "/alerts",
  ]) {
    test(`${path} has no accessibility violations in dark mode`, async ({
      page,
      checkAccessibility,
    }) => {
      await page.addInitScript(() => localStorage.setItem("hire-tracker-theme", "dark"));
      await page.goto(path);
      await expect(html(page)).toHaveAttribute("data-theme", "dark");

      await checkAccessibility();
    });
  }
});
