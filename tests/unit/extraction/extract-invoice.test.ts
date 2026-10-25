import { describe, expect, it } from "vitest";
import { extractInvoice } from "@/lib/extraction/extract-invoice";
import { contractInvoice, despatchInvoice, fragmentsOf } from "../../support/invoice-documents";

const read = (document: string) => extractInvoice(fragmentsOf(document));

describe("extractInvoice", () => {
  it("returns null for a document in a layout it does not know", () => {
    expect(read("Dear customer,\nPlease find our price list attached.\n")).toBeNull();
  });

  it("warns when the lines do not add up to the net total printed", () => {
    const document = despatchInvoice().replace("GOODS      554.40", "GOODS      560.00");
    expect(read(document)?.warnings).toEqual([
      "The lines add up to £554.40 but the net total printed is £560.00: check the lines.",
    ]);
  });

  it("warns when the VAT on the lines does not add up to the VAT printed", () => {
    const document = contractInvoice().replace("£105.13", "£105.10");
    expect(read(document)?.warnings).toEqual([
      "The VAT on the lines adds up to £105.13 but the VAT printed is £105.10: check the VAT.",
    ]);
  });

  it("warns about every header field it could not read, and leaves it out", () => {
    const document = despatchInvoice()
      .replace("Invoice No       : 30451207", "")
      .replace("Invoice Date     : 31/08/2026", "Invoice Date     : 31/02/2026");
    const result = read(document);
    expect(result?.invoice.number).toBeUndefined();
    expect(result?.invoice.date).toBeUndefined();
    expect(result?.warnings).toEqual([
      "Could not read the invoice number.",
      "Could not read the invoice date.",
    ]);
  });

  it("warns when it finds no lines", () => {
    const document = contractInvoice()
      .replace(/^\d\d\/08\/2026.*$/gm, "")
      .replace(/^ {20,}.*(Waiver|week for|commenced|previous|off hired).*$/gm, "");
    expect(read(document)?.warnings).toContain("Could not read any invoice lines.");
  });
});
