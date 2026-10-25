import { supplierData } from "../support/test-data";
import { expect, test } from "./fixtures";

test.describe("POST /api/suppliers", () => {
  test(
    "creates a supplier with the default charging profile",
    { tag: "@smoke" },
    async ({ request }) => {
      const data = supplierData();

      const response = await request.post("/api/suppliers", { data });

      expect(response.status()).toBe(201);
      expect(await response.json()).toEqual({
        id: expect.any(String),
        name: data.name,
        accountNo: null,
        chargeBankHolidays: true,
        minChargeDays: 5,
        damageWaiverPct: 10,
        paymentTerms: "END_OF_NEXT_MONTH",
        paymentTermsDays: null,
      });
    },
  );

  test("rejects a second supplier with the same name with 409", async ({ request, api }) => {
    const existing = await api.createSupplier();

    const response = await request.post("/api/suppliers", { data: { name: existing.name } });

    expect(response.status()).toBe(409);
    expect((await response.json()).error.code).toBe("DUPLICATE_SUPPLIER");
  });

  test("requires the number of days when payment terms are NET_N", async ({ request }) => {
    const response = await request.post("/api/suppliers", {
      data: supplierData({ paymentTerms: "NET_N" }),
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toMatchObject({
      code: "VALIDATION_ERROR",
      issues: [{ path: ["paymentTermsDays"] }],
    });
  });

  test("rejects a body that is not valid JSON with 400", async ({ request }) => {
    const response = await request.post("/api/suppliers", {
      headers: { "content-type": "application/json" },
      // A Buffer is sent as raw bytes; a string would be encoded as a valid JSON string.
      data: Buffer.from("{ not json"),
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.message).toBe("Request body must be valid JSON");
  });
});

test.describe("GET /api/suppliers", () => {
  test("lists a supplier that was created", async ({ request, api }) => {
    const supplier = await api.createSupplier();

    const response = await request.get("/api/suppliers");

    expect(response.status()).toBe(200);
    expect(await response.json()).toContainEqual(expect.objectContaining({ id: supplier.id }));
  });
});
