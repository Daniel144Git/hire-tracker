import { uniqueCode } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("Sites page", () => {
  test("adds a site and shows it in the list", { tag: "@smoke" }, async ({ sitesPage }) => {
    const code = uniqueCode();
    await sitesPage.goto();

    await sitesPage.addSite({ code: code.toLowerCase(), name: "Riverside Tower" });

    await expect(sitesPage.successMessage).toHaveText(`Site ${code} added`);
    await expect(sitesPage.row(code)).toContainText("Riverside Tower");
  });

  test("shows the error next to the code when the code is already used", async ({
    sitesPage,
    api,
  }) => {
    const existing = await api.createSite();
    await sitesPage.goto();

    await sitesPage.addSite({ code: existing.code, name: "Another site" });

    await expect(sitesPage.codeInput).toHaveAttribute("aria-invalid", "true");
    await expect(sitesPage.codeInput).toHaveAccessibleDescription(
      `Site code ${existing.code} is already used`,
    );
    await expect(sitesPage.nameInput).toHaveValue("Another site");
  });

  test("opens a site from the list", async ({ sitesPage, sitePage, api }) => {
    const site = await api.createSite();
    await sitesPage.goto();

    await sitesPage.openSite(site.code);

    await expect(sitePage.heading).toHaveText(`${site.code} - ${site.name}`);
  });

  test("has no accessibility violations", async ({ sitesPage, api, checkAccessibility }) => {
    await api.createSite();
    await sitesPage.goto();
    await expect(sitesPage.sitesTable).toBeVisible();

    await checkAccessibility();
  });
});
