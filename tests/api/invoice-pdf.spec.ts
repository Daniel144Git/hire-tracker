import { randomInt } from "node:crypto";
import { contractInvoice, despatchInvoice, pdfOf } from "../support/invoice-documents";
import { invoiceData, uniqueCode } from "../support/test-data";
import { expect, test } from "./fixtures";

const extractUrl = "/api/invoices/extract";

test.describe("Reading invoice PDFs", () => {
  test(
    "reads an invoice PDF and finds the supplier by the account number printed on it",
    { tag: "@smoke" },
    async ({ api }) => {
      const accountNo = `ACC-${uniqueCode(6)}`;
      const supplier = await api.createSupplier({ accountNo });
      const number = uniqueCode(8);

      const extraction = await api.extractPdf(await pdfOf(despatchInvoice({ accountNo, number })));

      expect(extraction).toMatchObject({
        layout: "despatch",
        supplier: { id: supplier.id, name: supplier.name },
        warnings: [],
        invoice: { number, date: "2026-08-31", type: "CONTINUATION", net: 554.4, gross: 665.28 },
      });
      expect(extraction.invoice?.lines).toHaveLength(2);
      expect(extraction.uploadId).toMatch(/^[0-9a-f-]{36}$/);
    },
  );

  test("saves the invoice read from a PDF and keeps the PDF with it", async ({ request, api }) => {
    const accountNo = `ACC-${uniqueCode(6)}`;
    const supplier = await api.createSupplier({ accountNo });
    const pdf = await pdfOf(despatchInvoice({ accountNo, number: uniqueCode(8) }));
    const { uploadId, invoice } = await api.extractPdf(pdf);

    const created = await request.post("/api/invoices", {
      data: { ...invoice, supplierId: supplier.id, uploadId },
    });
    expect(created.status()).toBe(201);
    const saved = await created.json();
    expect(saved).toMatchObject({ hasFile: true, net: 554.4, lines: [{}, {}] });

    const file = await request.get(`/api/invoices/${saved.id}/file`);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-type"]).toBe("application/pdf");
    expect(Buffer.from(await file.body()).equals(Buffer.from(pdf))).toBe(true);
  });

  test("links a contract-layout invoice to the hire order by our order number", async ({
    request,
    api,
  }) => {
    // This layout prints the account as letters then digits, e.g. "AC123456".
    const accountNo = `AC${randomInt(100_000, 1_000_000)}`;
    const supplier = await api.createSupplier({ accountNo });
    const order = await api.createOrder({ supplier });
    const pdf = await pdfOf(
      contractInvoice({ accountNo, orderRef: order.orderRef ?? "", number: uniqueCode(8) }),
    );
    const { uploadId, invoice, supplier: found } = await api.extractPdf(pdf);
    expect(found?.id).toBe(supplier.id);

    const created = await request.post("/api/invoices", {
      data: { ...invoice, supplierId: supplier.id, uploadId },
    });
    expect(created.status()).toBe(201);
    const saved = await created.json();
    expect(saved.orderRef).toBe(order.orderRef);
    expect(saved.lines[0].order?.id).toBe(order.id);
    expect(saved.site?.id).toBe(order.site.id);
  });

  test("keeps a PDF with one invoice only", async ({ request, api }) => {
    const supplier = await api.createSupplier();
    const { uploadId } = await api.extractPdf(await pdfOf(despatchInvoice()));
    await api.createInvoiceForSupplier(supplier, { uploadId });

    const second = await request.post("/api/invoices", {
      data: { ...invoiceData({ supplierId: supplier.id }), uploadId },
    });

    expect(second.status()).toBe(400);
    expect((await second.json()).error.issues).toEqual([
      { path: ["uploadId"], message: "Unknown upload" },
    ]);
  });

  test("warns when no supplier has the account number on the invoice", async ({ api }) => {
    const accountNo = `NONE-${uniqueCode(6)}`;

    const extraction = await api.extractPdf(await pdfOf(despatchInvoice({ accountNo })));

    expect(extraction.supplier).toBeNull();
    expect(extraction.warnings).toEqual([
      `No supplier has account number ${accountNo}: choose the supplier, and add the account number to it.`,
    ]);
  });

  test("warns when the invoice is already recorded", async ({ api }) => {
    const accountNo = `ACC-${uniqueCode(6)}`;
    const supplier = await api.createSupplier({ accountNo });
    const number = uniqueCode(8);
    await api.createInvoiceForSupplier(supplier, { number });

    const extraction = await api.extractPdf(await pdfOf(despatchInvoice({ accountNo, number })));

    expect(extraction.warnings).toEqual([
      `Invoice ${number} from ${supplier.name} is already recorded.`,
    ]);
  });

  test("keeps a PDF it cannot read, so it can go with an invoice typed in", async ({ api }) => {
    const extraction = await api.extractPdf(await pdfOf("Price list\nScissor lift  £50.00"));

    expect(extraction).toMatchObject({ layout: null, supplier: null, invoice: null });
    expect(extraction.warnings).toEqual([
      "The PDF is not in a layout the app can read: enter the invoice by hand.",
    ]);
    expect(extraction.uploadId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("rejects a file that is not a PDF, with 400", async ({ request }) => {
    const response = await request.post(extractUrl, {
      multipart: {
        file: { name: "invoice.pdf", mimeType: "application/pdf", buffer: Buffer.from("hello") },
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toEqual({
      code: "VALIDATION_ERROR",
      message: "The file is not a PDF",
      issues: [{ path: ["file"], message: "The file is not a PDF" }],
    });
  });

  test("rejects a request without a file, with 400", async ({ request }) => {
    const response = await request.post(extractUrl, { data: { file: "invoice.pdf" } });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.issues[0].path).toEqual(["file"]);
  });

  test("answers 404 for the file of an invoice that has none", async ({ request, api }) => {
    const invoice = await api.createInvoiceForSupplier(await api.createSupplier());

    const response = await request.get(`/api/invoices/${invoice.id}/file`);

    expect(response.status()).toBe(404);
    expect(invoice.hasFile).toBe(false);
  });
});
