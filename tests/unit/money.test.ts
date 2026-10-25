import { describe, expect, it } from "vitest";
import { fromPence, round2, toPence } from "@/lib/money";

describe("round2: rounds money to the penny", () => {
  it("leaves an amount that already has two decimals unchanged", () => {
    expect(round2(210.0)).toBe(210);
    expect(round2(41.28)).toBe(41.28);
  });

  it("rounds a half penny up", () => {
    expect(round2(0.125)).toBe(0.13);
  });

  it("rounds 1.005 to 1.01 even though 1.005 * 100 is 100.49999999999999 in floating point", () => {
    expect(round2(1.005)).toBe(1.01);
  });

  it("rounds VAT on a line to the penny: 20% of 41.29 is 8.258, billed as 8.26", () => {
    expect(round2(41.29 * 0.2)).toBe(8.26);
  });

  it("rounds a negative half penny away from zero, so credits mirror charges", () => {
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(-0.125)).toBe(-0.13);
  });

  it("returns 0, not -0, when a tiny credit rounds to nothing", () => {
    expect(Object.is(round2(-0.001), 0)).toBe(true);
  });
});

describe("toPence and fromPence: money is stored as whole pence", () => {
  it.each([
    [50, 5000],
    [41.29, 4129],
    [3.75, 375],
    [0.1, 10],
    [0, 0],
  ])("£%s is %i pence", (pounds, pence) => {
    expect(toPence(pounds)).toBe(pence);
    expect(fromPence(pence)).toBe(pounds);
  });

  it("ignores floating-point noise: £19.99 is 1999 pence, not 1998", () => {
    // 19.99 * 100 is 1998.9999999999998 in floating point; cutting off the decimals gives 1998.
    expect(toPence(19.99)).toBe(1999);
  });

  it("rejects an amount with fractions of a penny", () => {
    expect(() => toPence(1.005)).toThrow(RangeError);
  });
});
