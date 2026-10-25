import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const port = Number(process.env.PORT ?? 3000);
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

  // Starts the app before the tests and waits until /api/health answers.
  // CI runs the production build (built in an earlier step); locally we use the dev server.
  webServer: {
    command: isCI ? "npm run start" : "npm run dev",
    url: `${baseURL}/api/health`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
