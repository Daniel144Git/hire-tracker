import { siteData, uniqueCode } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("POST /api/sites", () => {
  test(
    "creates a site and normalises the code to upper case",
    { tag: "@smoke" },
    async ({ request }) => {
      const code = uniqueCode();

      const response = await request.post("/api/sites", {
        data: { code: ` ${code.toLowerCase()} `, name: "Riverside Tower" },
      });

      expect(response.status()).toBe(201);
      expect(await response.json()).toEqual({
        id: expect.any(String),
        code,
        name: "Riverside Tower",
        deliveryAddress: null,
        ordersOnHire: 0,
      });
    },
  );

  test("rejects a duplicate site code with 409, whatever its case", async ({ request, api }) => {
    const existing = await api.createSite();

    const response = await request.post("/api/sites", {
      data: siteData({ code: existing.code.toLowerCase() }),
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error.code).toBe("DUPLICATE_SITE_CODE");
  });

  test("rejects an invalid code with 400 and says which field is wrong", async ({ request }) => {
    const response = await request.post("/api/sites", { data: siteData({ code: "RV-S" }) });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toEqual({
      code: "VALIDATION_ERROR",
      message: "The request is not valid",
      issues: [{ path: ["code"], message: "Code must be 2 to 6 letters or digits" }],
    });
  });

  test("rejects unknown fields with 400", async ({ request }) => {
    const response = await request.post("/api/sites", { data: siteData({ colour: "blue" }) });

    expect(response.status()).toBe(400);
  });
});

test.describe("GET /api/sites and /api/sites/:id", () => {
  test("lists a site that was created", async ({ request, api }) => {
    const site = await api.createSite();

    const response = await request.get("/api/sites");

    expect(response.status()).toBe(200);
    expect(await response.json()).toContainEqual(site);
  });

  test("returns one site by id", async ({ request, api }) => {
    const site = await api.createSite();

    const response = await request.get(`/api/sites/${site.id}`);

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(site);
  });

  test("returns 404 for a site that does not exist", async ({ request }) => {
    const response = await request.get("/api/sites/does-not-exist");

    expect(response.status()).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  test("counts only the orders still on hire", async ({ request, api }) => {
    const site = await api.createSite();
    const supplier = await api.createSupplier();
    await api.createOrder({ site, supplier });
    const offHired = await api.createOrder({ site, supplier });
    await api.offHire(offHired.id, { offHireDate: "2026-08-20" });

    const response = await request.get(`/api/sites/${site.id}`);

    expect((await response.json()).ordersOnHire).toBe(1);
  });
});

test.describe("PATCH /api/sites/:id", () => {
  test("renames a site", async ({ request, api }) => {
    const site = await api.createSite();

    const response = await request.patch(`/api/sites/${site.id}`, {
      data: { name: "Riverside Tower Phase 2" },
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ ...site, name: "Riverside Tower Phase 2" });
  });

  test("rejects changing the code to one another site uses, with 409", async ({ request, api }) => {
    const [site, other] = await Promise.all([api.createSite(), api.createSite()]);

    const response = await request.patch(`/api/sites/${site.id}`, { data: { code: other.code } });

    expect(response.status()).toBe(409);
  });

  test("rejects an empty update with 400", async ({ request, api }) => {
    const site = await api.createSite();

    const response = await request.patch(`/api/sites/${site.id}`, { data: {} });

    expect(response.status()).toBe(400);
  });

  test("returns 404 for a site that does not exist", async ({ request }) => {
    const response = await request.patch("/api/sites/does-not-exist", { data: { name: "X" } });

    expect(response.status()).toBe(404);
  });
});
