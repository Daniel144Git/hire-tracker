import { despatchInvoice, pdfOf } from "../support/invoice-documents";
import { uniqueCode } from "../support/test-data";
import { expect, test } from "./fixtures";

const upload = (pdf: Uint8Array, name: string) => ({
  multipart: { file: { name, mimeType: "application/pdf", buffer: Buffer.from(pdf) } },
});

test.describe("Uploading many invoices at once", () => {
  test(
    "saves an invoice read cleanly, with its PDF and its checks",
    { tag: "@smoke" },
    async ({ request, api }) => {
      const accountNo = `ACC-${uniqueCode(6)}`;
      const supplier = await api.createSupplier({ accountNo });
      const number = uniqueCode(8);

      const response = await request.post(
        "/api/invoices/import",
        upload(await pdfOf(despatchInvoice({ accountNo, number })), `${number}.pdf`),
      );

      expect(response.status()).toBe(201);
      const result = await response.json();
      expect(result).toMatchObject({
        fileName: `${number}.pdf`,
        status: "SAVED",
        invoice: { number },
      });
      const saved = await api.getInvoice(result.invoice.id);
      expect(saved).toMatchObject({ supplier: { id: supplier.id }, hasFile: true, net: 554.4 });
    },
  );

  test("reports an invoice already recorded and saves nothing", async ({ request, api }) => {
    const accountNo = `ACC-${uniqueCode(6)}`;
    const supplier = await api.createSupplier({ accountNo });
    const number = uniqueCode(8);
    const existing = await api.createInvoiceForSupplier(supplier, { number });

    const response = await request.post(
      "/api/invoices/import",
      upload(await pdfOf(despatchInvoice({ accountNo, number })), "again.pdf"),
    );

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      fileName: "again.pdf",
      status: "ALREADY_RECORDED",
      invoice: { id: existing.id, number },
      message: `Invoice ${number} from ${supplier.name} is already recorded`,
    });
  });

  test("keeps an invoice that needs checking, until it is saved", async ({ request, api }) => {
    const accountNo = `NONE-${uniqueCode(6)}`;
    const number = uniqueCode(8);

    const response = await request.post(
      "/api/invoices/import",
      upload(await pdfOf(despatchInvoice({ accountNo, number })), "unknown.pdf"),
    );

    expect(response.status()).toBe(201);
    const result = await response.json();
    expect(result).toMatchObject({
      status: "TO_CHECK",
      warnings: [
        `No supplier has account number ${accountNo}: choose the supplier, and add the account number to it.`,
      ],
    });

    const draft = await (await request.get(`/api/invoices/drafts/${result.draftId}`)).json();
    expect(draft).toMatchObject({
      fileName: "unknown.pdf",
      values: { number, net: "554.4" },
      missing: { supplierId: "Not recognised: choose the supplier" },
    });
    const drafts = await (await request.get("/api/invoices/drafts")).json();
    expect(drafts.map((d: { id: string }) => d.id)).toContain(result.draftId);

    // Saving the invoice with the draft's PDF takes it off the list.
    const supplier = await api.createSupplier();
    const saved = await request.post("/api/invoices", {
      data: {
        ...invoiceFromValues(draft.values),
        supplierId: supplier.id,
        uploadId: draft.uploadId,
      },
    });
    expect(saved.status()).toBe(201);
    expect((await saved.json()).hasFile).toBe(true);
    expect((await request.get(`/api/invoices/drafts/${result.draftId}`)).status()).toBe(404);
  });

  test("discards an invoice to check", async ({ request }) => {
    const result = await (
      await request.post(
        "/api/invoices/import",
        upload(await pdfOf(despatchInvoice({ accountNo: `NONE-${uniqueCode(6)}` })), "x.pdf"),
      )
    ).json();

    const response = await request.delete(`/api/invoices/drafts/${result.draftId}`);

    expect(response.status()).toBe(204);
    expect((await request.get(`/api/invoices/drafts/${result.draftId}`)).status()).toBe(404);
  });

  test("keeps a PDF it cannot read for checking, and refuses a file that is not a PDF", async ({
    request,
  }) => {
    const unread = await request.post(
      "/api/invoices/import",
      upload(await pdfOf("Price list\nScissor lift  £50.00"), "list.pdf"),
    );
    expect(await unread.json()).toMatchObject({
      status: "TO_CHECK",
      warnings: ["The PDF is not in a layout the app can read: enter the invoice by hand."],
    });

    const notPdf = await request.post(
      "/api/invoices/import",
      upload(new TextEncoder().encode("hello"), "notes.pdf"),
    );
    expect(notPdf.status()).toBe(400);
  });
});

/** The API body of an invoice from the form values of a draft (numbers back to numbers). */
function invoiceFromValues(values: Record<string, string>) {
  const lines: Record<string, unknown>[] = [];
  const header: Record<string, unknown> = {};
  const numbers = new Set(["qty", "weeks", "days", "rate", "net", "vat", "gross"]);
  for (const [name, value] of Object.entries(values)) {
    const line = /^lines\.(\d+)\.(\w+)$/.exec(name);
    if (line) {
      lines[Number(line[1])] ??= {};
      lines[Number(line[1])][line[2]] = numbers.has(line[2]) ? Number(value) : value;
    } else if (name !== "supplierId") {
      header[name] = numbers.has(name) ? Number(value) : name === "isCreditNote" ? true : value;
    }
  }
  return { ...header, lines };
}
