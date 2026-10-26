import { describe, expect, it } from "vitest";
import { missingFieldErrors } from "@/lib/extraction/review";

const complete = {
  supplierId: "s1",
  number: "30451207",
  date: "2026-08-31",
  type: "CONTINUATION",
  net: "554.4",
  vat: "110.88",
  gross: "665.28",
  "lines.0.description": "Scissor lift",
};

/** The values without some fields, as if the PDF had not given them. */
const without = (...names: string[]) =>
  Object.fromEntries(Object.entries(complete).filter(([name]) => !names.includes(name)));

describe("missingFieldErrors: what a person must fill in before saving a read invoice", () => {
  it("asks for nothing when every required field was read", () => {
    expect(missingFieldErrors(complete)).toEqual({});
  });

  it("marks each required field that could not be read", () => {
    expect(missingFieldErrors(without("supplierId", "number", "gross"))).toEqual({
      supplierId: "Not recognised: choose the supplier",
      number: "Not read from the PDF: fill it in",
      gross: "Not read from the PDF: fill it in",
    });
  });

  it("asks for the lines when none could be read", () => {
    expect(missingFieldErrors(without("lines.0.description"))).toEqual({
      "lines.0.description": "No lines read from the PDF: enter them",
    });
  });
});
