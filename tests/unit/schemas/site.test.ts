import { describe, expect, it } from "vitest";
import { siteCreateSchema, siteUpdateSchema } from "@/lib/schemas/site";

describe("siteCreateSchema", () => {
  it("accepts a code and a name, trims them and upper-cases the code", () => {
    const result = siteCreateSchema.parse({ code: " rvs ", name: " Riverside Tower " });
    expect(result).toEqual({ code: "RVS", name: "Riverside Tower" });
  });

  it("accepts an optional delivery address", () => {
    const result = siteCreateSchema.parse({
      code: "RVS",
      name: "Riverside Tower",
      deliveryAddress: "1 Riverside Walk",
    });
    expect(result.deliveryAddress).toBe("1 Riverside Walk");
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["too short", "R"],
    ["too long", "RIVERSIDE"],
    ["with a space", "RV S"],
    ["with a dash", "RV-S"],
  ])("rejects a code that is %s", (_case, code) => {
    expect(siteCreateSchema.safeParse({ code, name: "Riverside Tower" }).success).toBe(false);
  });

  it("rejects an empty name, even when it is only spaces", () => {
    expect(siteCreateSchema.safeParse({ code: "RVS", name: "   " }).success).toBe(false);
  });

  it("rejects unknown fields, so a typo in a field name is not silently ignored", () => {
    const result = siteCreateSchema.safeParse({ code: "RVS", name: "Riverside", nmae: "typo" });
    expect(result.success).toBe(false);
  });
});

describe("siteUpdateSchema", () => {
  it("accepts a change to a single field", () => {
    expect(siteUpdateSchema.parse({ name: "Riverside Tower Phase 2" })).toEqual({
      name: "Riverside Tower Phase 2",
    });
  });

  it("rejects an update with no fields", () => {
    expect(siteUpdateSchema.safeParse({}).success).toBe(false);
  });
});
