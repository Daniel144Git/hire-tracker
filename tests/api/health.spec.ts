import { expect, test } from "@playwright/test";

test.describe("GET /api/health", () => {
  test("returns 200 with status ok as JSON", { tag: "@smoke" }, async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("rejects POST with 405 Method Not Allowed", async ({ request }) => {
    const response = await request.post("/api/health");

    expect(response.status()).toBe(405);
  });
});
