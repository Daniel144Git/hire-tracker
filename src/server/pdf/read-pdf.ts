import { getDocumentProxy } from "unpdf";
import type { TextFragment } from "@/lib/extraction/pdf-lines";

/**
 * The text of a PDF with where each piece is printed, page by page. A scanned PDF has no text
 * and gives an empty list. Throws when the bytes are not a readable PDF.
 */
export async function readPdfText(bytes: Uint8Array): Promise<TextFragment[]> {
  // The PDF reader takes ownership of the buffer it is given, so it gets a copy.
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  try {
    const fragments: TextFragment[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const { items } = await page.getTextContent();
      for (const item of items) {
        if (!("str" in item) || item.str.trim() === "") continue;
        fragments.push({
          page: pageNumber,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          text: item.str,
        });
      }
    }
    return fragments;
  } finally {
    // Frees the document and its in-process worker.
    await pdf.loadingTask.destroy();
  }
}
