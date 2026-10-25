import { despatchStatement, pdfOf } from "../support/invoice-documents";
import { uniqueCode } from "../support/test-data";
import { expect, test } from "./fixtures";

const multipart = (pdf: Uint8Array, name = "statement.pdf") => ({
  multipart: { file: { name, mimeType: "application/pdf", buffer: Buffer.from(pdf) } },
});

test.describe("Supplier statements (R11)", () => {
  test(
    "compares a statement with our invoices: matched, missing, different, not listed",
    { tag: "@smoke" },
    async ({ api }) => {
      const supplier = await api.createSupplier();
      const listed = await api.createInvoiceForSupplier(supplier, { number: uniqueCode(8) });
      const different = await api.createInvoiceForSupplier(supplier, { number: uniqueCode(8) });
      const notListed = await api.createInvoiceForSupplier(supplier, { number: uniqueCode(8) });
      const neverReceived = uniqueCode(8);

      const statement = await api.createStatement({
        supplierId: supplier.id,
        date: "2026-09-01",
        lines: [
          { invoiceDate: "2026-08-31", invoiceNo: listed.number, amount: 277.2 },
          { invoiceDate: "2026-08-31", invoiceNo: different.number, amount: 287.2 },
          { invoiceDate: "2026-08-20", invoiceNo: neverReceived, amount: 336.19 },
        ],
      });

      expect(statement.summary).toEqual({
        lineCount: 3,
        matched: 2,
        problemCount: 3,
        highCount: 2,
      });
      expect(statement.problems.map((p) => [p.kind, p.invoiceNo])).toEqual([
        ["AMOUNT_DIFFERS", different.number],
        ["MISSING_INVOICE", neverReceived],
        ["NOT_ON_STATEMENT", notListed.number],
      ]);
      expect(statement.lines[0].invoice).toEqual({ id: listed.id, number: listed.number });
    },
  );

  test("an invoice entered after the statement repairs the comparison", async ({ api }) => {
    const supplier = await api.createSupplier();
    const number = uniqueCode(8);
    const statement = await api.createStatement({
      supplierId: supplier.id,
      date: "2026-09-01",
      lines: [{ invoiceDate: "2026-08-31", invoiceNo: number, amount: 277.2 }],
    });
    expect(statement.problems.map((p) => p.kind)).toEqual(["MISSING_INVOICE"]);

    await api.createInvoiceForSupplier(supplier, { number });

    expect((await api.getStatement(statement.id)).problems).toEqual([]);
  });

  test("marks paid the invoices the statement no longer lists", async ({ request, api }) => {
    const supplier = await api.createSupplier();
    const paid = await api.createInvoiceForSupplier(supplier, { number: uniqueCode(8) });
    const statement = await api.createStatement({
      supplierId: supplier.id,
      date: "2026-09-01",
      lines: [],
    });

    const response = await request.post(`/api/statements/${statement.id}/mark-paid`);

    expect(response.status()).toBe(200);
    expect((await response.json()).problems).toEqual([]);
    expect((await api.getInvoice(paid.id)).paymentStatus).toBe("PAID");
  });

  test("flags an invoice paid here that the latest statement still lists", async ({ api }) => {
    const supplier = await api.createSupplier();
    const invoice = await api.createInvoiceForSupplier(supplier, { number: uniqueCode(8) });
    const line = { invoiceDate: "2026-08-31", invoiceNo: invoice.number, amount: 277.2 };
    const september = await api.createStatement({
      supplierId: supplier.id,
      date: "2026-09-01",
      lines: [line],
    });
    await api.updateInvoice(invoice.id, { paymentStatus: "PAID" });
    expect((await api.getStatement(september.id)).problems.map((p) => p.kind)).toEqual([
      "PAID_BUT_LISTED",
    ]);

    // Once a later statement exists, September is history: it listed what was open then.
    await api.createStatement({ supplierId: supplier.id, date: "2026-10-01", lines: [] });

    expect(await api.getStatement(september.id)).toMatchObject({ isLatest: false, problems: [] });
  });

  test("imports a statement PDF, finds the supplier and keeps the file", async ({
    request,
    api,
  }) => {
    const accountNo = `ACC-${uniqueCode(6)}`;
    const supplier = await api.createSupplier({ accountNo });
    const number = uniqueCode(8);
    const pdf = await pdfOf(
      despatchStatement({
        accountNo,
        rows: [
          ["31/08/2026", "170200345", number, "Riverside", 277.2],
          ["30/08/2026", "170200345", uniqueCode(8), "Riverside Tower Block B", -31.68],
        ],
      }),
    );
    await api.createInvoiceForSupplier(supplier, { number });

    const response = await request.post("/api/statements/upload", multipart(pdf));

    expect(response.status()).toBe(201);
    const statement = await response.json();
    expect(statement).toMatchObject({
      supplier: { id: supplier.id },
      date: "2026-09-02",
      total: 245.52,
      hasFile: true,
      summary: { lineCount: 2, matched: 1, problemCount: 1, highCount: 1 },
    });
    const file = await request.get(`/api/statements/${statement.id}/file`);
    expect(file.headers()["content-type"]).toBe("application/pdf");
  });

  test("refuses a statement whose lines do not add up to its total", async ({ request, api }) => {
    const accountNo = `ACC-${uniqueCode(6)}`;
    await api.createSupplier({ accountNo });
    const document = despatchStatement({ accountNo }).replace(" 1,355.28 ", " 1,355.82 ");

    const response = await request.post("/api/statements/upload", multipart(await pdfOf(document)));

    expect(response.status()).toBe(400);
    expect((await response.json()).error.message).toBe(
      "The statement could not be read reliably. The lines add up to £1,355.28 but the statement total is £1,355.82.",
    );
  });

  test("refuses a statement from an account no supplier has", async ({ request }) => {
    const accountNo = `NONE-${uniqueCode(6)}`;

    const response = await request.post(
      "/api/statements/upload",
      multipart(await pdfOf(despatchStatement({ accountNo }))),
    );

    expect(response.status()).toBe(400);
    expect((await response.json()).error.message).toBe(
      `No supplier has account number ${accountNo}: add it to the supplier first`,
    );
  });

  test("refuses a second statement for the same date, with 409", async ({ request, api }) => {
    const supplier = await api.createSupplier();
    const body = { supplierId: supplier.id, date: "2026-09-01", lines: [] };
    await api.createStatement(body);

    const response = await request.post("/api/statements", { data: body });

    expect(response.status()).toBe(409);
    expect((await response.json()).error.code).toBe("DUPLICATE_STATEMENT");
  });

  test("refuses lines that do not add up to the total given", async ({ request, api }) => {
    const supplier = await api.createSupplier();

    const response = await request.post("/api/statements", {
      data: {
        supplierId: supplier.id,
        date: "2026-09-01",
        total: 100,
        lines: [{ invoiceDate: "2026-08-31", invoiceNo: "X1", amount: 90 }],
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.issues).toEqual([
      { path: ["total"], message: "The lines add up to £90.00, not the total of £100.00" },
    ]);
  });

  test("answers 404 for a statement that does not exist", async ({ request }) => {
    expect((await request.get("/api/statements/nope")).status()).toBe(404);
  });
});
