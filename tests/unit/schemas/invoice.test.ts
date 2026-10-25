import { describe, expect, it } from "vitest";
import { invoiceCreateSchema, invoiceLineSchema } from "@/lib/schemas/invoice";

const hireLine = {
  description: "Scissor lift 19ft electric",
  fleetCode: "apx-sl-1042",
  periodFrom: "2026-08-01",
  periodTo: "2026-08-31",
  weeks: 4,
  days: 1,
  rate: 50,
  chargeType: "HIRE",
  net: 210,
  vat: 42,
};

const invoice = {
  supplierId: "supplier-1",
  number: " inv-20817 ",
  date: "2026-08-31",
  type: "CONTINUATION",
  jobNo: "j100101",
  net: 231,
  vat: 46.2,
  gross: 277.2,
  lines: [
    hireLine,
    { description: "Damage waiver 10%", chargeType: "DAMAGE_WAIVER", net: 21, vat: 4.2 },
  ],
};

describe("invoiceLineSchema", () => {
  it("accepts a hire line, defaults qty to 1 and upper-cases the fleet code", () => {
    const line = invoiceLineSchema.parse(hireLine);
    expect(line).toMatchObject({ fleetCode: "APX-SL-1042", qty: 1 });
  });

  it("accepts a credit line: negative amounts and a period printed with From after To", () => {
    const credit = {
      ...hireLine,
      periodFrom: "2026-08-31",
      periodTo: "2026-08-27",
      net: -30,
      vat: -6,
    };
    expect(invoiceLineSchema.safeParse(credit).success).toBe(true);
  });

  it("requires both ends of a billing period, or neither", () => {
    const result = invoiceLineSchema.safeParse({ ...hireLine, periodTo: undefined });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["periodTo"]);
  });

  it("rejects 5 or more extra days: they would be a week", () => {
    expect(invoiceLineSchema.safeParse({ ...hireLine, days: 5 }).success).toBe(false);
  });

  it("rejects an amount with fractions of a penny", () => {
    expect(invoiceLineSchema.safeParse({ ...hireLine, net: 210.001 }).success).toBe(false);
  });

  it("rejects a charge type that does not exist", () => {
    expect(invoiceLineSchema.safeParse({ ...hireLine, chargeType: "FUEL" }).success).toBe(false);
  });
});

describe("invoiceCreateSchema", () => {
  it("accepts a continuation invoice and normalises the numbers", () => {
    const result = invoiceCreateSchema.parse(invoice);
    expect(result).toMatchObject({ number: "INV-20817", jobNo: "J100101", isCreditNote: false });
    expect(result.dueDate).toBeUndefined();
  });

  it("accepts amounts as printed even when they do not add up: checking them is not data entry's job", () => {
    expect(invoiceCreateSchema.safeParse({ ...invoice, gross: 300 }).success).toBe(true);
  });

  it("rejects a due date before the invoice date", () => {
    const result = invoiceCreateSchema.safeParse({ ...invoice, dueDate: "2026-08-30" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["dueDate"]);
  });

  it("rejects an invoice with no lines", () => {
    expect(invoiceCreateSchema.safeParse({ ...invoice, lines: [] }).success).toBe(false);
  });

  it("rejects an invoice type that does not exist", () => {
    expect(invoiceCreateSchema.safeParse({ ...invoice, type: "INTERIM" }).success).toBe(false);
  });
});
