import { describe, expect, it } from "vitest";
import { parseAmount, parseUkDate } from "@/lib/extraction/fields";

describe("parseUkDate", () => {
  it.each([
    ["31/08/2026", "2026-08-31"],
    ["01/03/26", "2026-03-01"],
    [": 03/03/2026", "2026-03-03"],
  ])("reads %s as %s", (text, expected) => {
    expect(parseUkDate(text)).toBe(expected);
  });

  it.each(["31/02/2026", "2026-08-31", "", "1/8/26 extra"])("rejects %j", (text) => {
    expect(parseUkDate(text)).toBeUndefined();
  });
});

describe("parseAmount", () => {
  it.each([
    ["£1,234.56", 1234.56],
    ["504.00", 504],
    ["1.50-", -1.5],
    ["-£5.00", -5],
    ["£0.00", 0],
  ])("reads %s as %d", (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });

  it.each(["abc", "£12", "12.5", "4 wks"])("rejects %j", (text) => {
    expect(parseAmount(text)).toBeUndefined();
  });
});
