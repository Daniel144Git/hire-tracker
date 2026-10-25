import { describe, expect, it } from "vitest";
import { supplierCreateSchema } from "@/lib/schemas/supplier";

describe("supplierCreateSchema", () => {
  it("accepts a supplier with only a name; the charging profile then uses the defaults", () => {
    expect(supplierCreateSchema.parse({ name: " Apex Plant Hire " })).toEqual({
      name: "Apex Plant Hire",
    });
  });

  it("accepts a full charging profile", () => {
    const supplier = {
      name: "Apex Plant Hire",
      accountNo: "APX-000123",
      chargeBankHolidays: false,
      minChargeDays: 5,
      damageWaiverPct: 10,
      paymentTerms: "NET_N",
      paymentTermsDays: 30,
    };
    expect(supplierCreateSchema.parse(supplier)).toEqual(supplier);
  });

  it("requires the number of days when payment terms are NET_N", () => {
    const result = supplierCreateSchema.safeParse({ name: "Apex", paymentTerms: "NET_N" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["paymentTermsDays"]);
  });

  it.each([-1, 101])("rejects a damage waiver of %s%%", (damageWaiverPct) => {
    expect(supplierCreateSchema.safeParse({ name: "Apex", damageWaiverPct }).success).toBe(false);
  });
});
