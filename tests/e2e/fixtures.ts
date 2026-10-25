import AxeBuilder from "@axe-core/playwright";
import { test as base } from "@playwright/test";
import { ApiClient } from "../support/api-client";
import { CostsPage } from "./pages/costs.page";
import { DiscrepancyReportPage } from "./pages/discrepancy-report.page";
import { HomePage } from "./pages/home.page";
import { InvoiceFormPage } from "./pages/invoice-form.page";
import { InvoicePage } from "./pages/invoice.page";
import { InvoicesPage } from "./pages/invoices.page";
import { PaymentsPage } from "./pages/payments.page";
import { SitePage } from "./pages/site.page";
import { SitesPage } from "./pages/sites.page";
import { StatementsPage } from "./pages/statements.page";

type Fixtures = {
  homePage: HomePage;
  sitesPage: SitesPage;
  sitePage: SitePage;
  invoicesPage: InvoicesPage;
  invoiceFormPage: InvoiceFormPage;
  invoicePage: InvoicePage;
  reportPage: DiscrepancyReportPage;
  paymentsPage: PaymentsPage;
  statementsPage: StatementsPage;
  costsPage: CostsPage;
  /** Creates test data through the API, so UI tests only drive the screen they are about. */
  api: ApiClient;
  /** Runs an axe accessibility scan of the current page (WCAG 2.1 A and AA rules). */
  checkAccessibility: () => Promise<void>;
};

/**
 * Extends Playwright's `test` so every test can ask for a ready-made page object
 * by name, e.g. `async ({ homePage }) => ...`, instead of constructing it itself.
 */
export const test = base.extend<Fixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  sitesPage: async ({ page }, use) => {
    await use(new SitesPage(page));
  },
  sitePage: async ({ page }, use) => {
    await use(new SitePage(page));
  },
  invoicesPage: async ({ page }, use) => {
    await use(new InvoicesPage(page));
  },
  invoiceFormPage: async ({ page }, use) => {
    await use(new InvoiceFormPage(page));
  },
  invoicePage: async ({ page }, use) => {
    await use(new InvoicePage(page));
  },
  reportPage: async ({ page }, use) => {
    await use(new DiscrepancyReportPage(page));
  },
  paymentsPage: async ({ page }, use) => {
    await use(new PaymentsPage(page));
  },
  statementsPage: async ({ page }, use) => {
    await use(new StatementsPage(page));
  },
  costsPage: async ({ page }, use) => {
    await use(new CostsPage(page));
  },
  api: async ({ request }, use) => {
    await use(new ApiClient(request));
  },
  checkAccessibility: async ({ page }, use) => {
    await use(async () => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      base.expect(results.violations, "accessibility violations").toEqual([]);
    });
  },
});

export { expect } from "@playwright/test";
