import { describe, expect, it } from "vitest";
import { groupIntoLines, type TextFragment } from "@/lib/extraction/pdf-lines";

const fragment = (text: string, x: number, y: number, page = 1): TextFragment => ({
  page,
  x,
  y,
  width: text.length * 4,
  text,
});

const texts = (fragments: TextFragment[]) => groupIntoLines(fragments).map((line) => line.text);

describe("groupIntoLines", () => {
  it("puts fragments at about the same height on one line, left to right", () => {
    // PDFs often place a label and its value a point apart: "VAT at 20%" at 71, "£70.08" at 72.
    expect(texts([fragment("£70.08", 300, 72), fragment("VAT at 20%", 200, 71)])).toEqual([
      "VAT at 20%\t£70.08",
    ]);
  });

  it("orders lines top to bottom, page by page", () => {
    const lines = texts([
      fragment("second page", 10, 700, 2),
      fragment("bottom", 10, 100),
      fragment("top", 10, 700),
    ]);
    expect(lines).toEqual(["top", "bottom", "second page"]);
  });

  it("keeps rows a few points apart on separate lines", () => {
    expect(texts([fragment("Your Ref", 300, 679), fragment("PIKES END", 10, 674)])).toEqual([
      "Your Ref",
      "PIKES END",
    ]);
  });

  it("joins fragments that touch into one cell and separates columns with a tab", () => {
    // "Invoice" ends at x 128; "No" starts 2 points later; the value is a column away.
    const lines = texts([
      fragment("Invoice", 100, 500),
      fragment("No", 130, 500),
      fragment(": 123", 200, 500),
    ]);
    expect(lines).toEqual(["Invoice No\t: 123"]);
  });

  it("normalises spaces inside a cell and drops empty fragments", () => {
    expect(texts([fragment("  4 wks   1 day ", 10, 500), fragment("   ", 100, 500)])).toEqual([
      "4 wks 1 day",
    ]);
  });

  it("gives each cell its x position, for column-based reading", () => {
    const [line] = groupIntoLines([fragment("b", 50, 10), fragment("a", 10, 10)]);
    expect(line.cells).toEqual([
      { x: 10, text: "a" },
      { x: 50, text: "b" },
    ]);
  });
});
