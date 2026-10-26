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

describe("missingFieldErrors: what a person must fill in before saving a read invoice", () => {
  it("asks for nothing when every required field was read", () => {
    expect(missingFieldErrors(complete)).toEqual({});
  });

  it("marks each required field that could not be read", () => {
    const { supplierId: _s, number: _n, gross: _g, ...rest } = complete;
    expect(missingFieldErrors(rest)).toEqual({
      supplierId: "Not recognised: choose the supplier",
      number: "Not read from the PDF: fill it in",
      gross: "Not read from the PDF: fill it in",
    });
  });

  it("asks for the lines when none could be read", () => {
    const { "lines.0.description": _l, ...rest } = complete;
    expect(missingFieldErrors(rest)).toEqual({
      "lines.0.description": "No lines read from the PDF: enter them",
    });
  });
});
