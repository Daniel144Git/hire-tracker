// Takes the README screenshots from the fictional demo data.
// 1. Start the app on a freshly seeded database, e.g. the Playwright test server:
//      npm run db:test:prepare && NEXT_DIST_DIR=.next-test DATABASE_URL=file:./prisma/test.db \
//        npx next build && NEXT_DIST_DIR=.next-test DATABASE_URL=file:./prisma/test.db npx next start --port 3100
// 2. node scripts/screenshots.mjs app        (before any test adds its own data)
// 3. npm run test:e2e, then node scripts/screenshots.mjs report
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";
const what = process.argv[2] ?? "app";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 860 },
  deviceScaleFactor: 2,
  colorScheme: "light",
});

if (what === "app") {
  // Each page, and what shows it has finished loading.
  await page.goto(`${BASE_URL}/reports/discrepancies?month=2026-08`);
  await page.getByTestId("report-summary").waitFor();
  await page.screenshot({ path: "docs/img/discrepancy-report.png" });

  await page.goto(`${BASE_URL}/invoices`);
  await page.getByRole("link", { name: "APX-20820" }).click();
  await page.getByRole("heading", { level: 1, name: "Invoice APX-20820" }).waitFor();
  await page.getByTestId("findings-summary").waitFor();
  await page.screenshot({ path: "docs/img/invoice.png" });

  await page.goto(`${BASE_URL}/statements`);
  await page.getByRole("link", { name: "2026-10-01" }).click();
  await page.getByTestId("statement-summary").waitFor();
  await page.screenshot({ path: "docs/img/statement.png" });
} else {
  await page.goto(pathToFileURL("playwright-report/index.html").href);
  await page.getByText("passed", { exact: false }).first().waitFor();
  await page.screenshot({ path: "docs/img/playwright-report.png" });
}
await browser.close();
console.log(`screenshots taken: ${what}`);
