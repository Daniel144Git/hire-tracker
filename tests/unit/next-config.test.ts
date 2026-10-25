import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig(distDir?: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_DIST_DIR", distDir);
  return (await import("../../next.config")).default;
}

describe("next.config: build folder (regression test for issue #5)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not set distDir for `npm run dev`: an explicit '.next' reloads pages in a loop", async () => {
    const config = await loadConfig(undefined);

    expect(config).not.toHaveProperty("distDir");
  });

  it("builds into the folder given by NEXT_DIST_DIR, as the Playwright test server does", async () => {
    const config = await loadConfig(".next-test");

    expect(config.distDir).toBe(".next-test");
  });
});
