import { describe, expect, it } from "vitest";
import { extractInvoice } from "@/lib/extraction/extract-invoice";
import { groupIntoLines } from "@/lib/extraction/pdf-lines";
import { readPdfText } from "@/server/pdf/read-pdf";
import {
  contractInvoice,
  despatchInvoice,
  fragmentsOf,
  pdfOf,
} from "../../support/invoice-documents";

// End to end on real PDF files: write the document as a PDF, read its text back with the
// PDF reader the app uses, and expect the same invoice as from the text itself.
describe("readPdfText", () => {
  it.each([
    ["despatch", despatchInvoice()],
    ["contract", contractInvoice()],
  ])("reads a %s layout PDF like the document it was made from", async (_layout, document) => {
    const fragments = await readPdfText(await pdfOf(document));
    expect(extractInvoice(fragments)).toEqual(extractInvoice(fragmentsOf(document)));
  });

  it("numbers the pages of a multi-page PDF", async () => {
    const lines = groupIntoLines(await readPdfText(await pdfOf("first page", "second page")));
    expect(lines.map(({ page, text }) => [page, text])).toEqual([
      [1, "first page"],
      [2, "second page"],
    ]);
  });

  it("returns no text for a PDF without any, such as a scan", async () => {
    expect(await readPdfText(await pdfOf(""))).toEqual([]);
  });

  it("throws on a file that is not a PDF", async () => {
    await expect(readPdfText(new TextEncoder().encode("not a pdf"))).rejects.toThrow();
  });
});
