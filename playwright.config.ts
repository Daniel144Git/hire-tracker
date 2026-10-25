import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
// Tests use their own port and database, so they never touch the data of `npm run dev`.
const port = Number(process.env.PORT ?? 3100);
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  // Fail the CI run if someone leaves a test.only in the code.
  forbidOnly: isCI,
  // One retry in CI, with a trace recorded on that retry to debug flaky tests. None locally.
  retries: isCI ? 1 : 0,
  fullyParallel: true,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [["list"], ["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      // API tests use only Playwright's `request` fixture: no browser is launched.
      name: "api",
      testDir: "./tests/api",
    },
    {
      name: "e2e",
      testDir: "./tests/e2e",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Recreates an empty test database, builds the app and starts the production server on it,
  // then waits until /api/health answers. Tests always run against a production build, locally
  // and in CI: the dev server's hot reload can reload a page in the middle of a test.
  webServer: {
    command: `npm run db:test:prepare && npx next build && npx next start --port ${port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    env: {
      DATABASE_URL: "file:./prisma/test.db",
      NEXT_DIST_DIR: ".next-test",
      INVOICE_FILES_DIR: "storage/test-invoice-files",
    },
  },
});
