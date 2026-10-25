import { strFromU8, unzipSync } from "fflate";
import { despatchInvoice, pdfOf } from "../support/invoice-documents";
import { uniqueCode, uniqueMonth } from "../support/test-data";
import { expect, test } from "./fixtures";

// Reports cover all the data, so every test uses a random far-future month of its own.

test.describe("Monthly costs by site and trade", () => {
  test(
    "adds the month's invoices by site and trade",
    { tag: "@smoke" },
    async ({ request, api }) => {
      const month = uniqueMonth();
      const mech = await api.createOrder();
      const elec = await api.createOrder({ overrides: { trade: "ELEC" } });
      await api.createInvoice(mech, { date: `${month}-28` });
      await api.createInvoice(elec, { date: `${month}-28` });

      const response = await request.get(`/api/reports/costs?month=${month}`);

      expect(response.status()).toBe(200);
      const report = await response.json();
      expect(report).toMatchObject({
        month,
        trades: ["MECH", "ELEC"],
        invoiceCount: 2,
        totals: { total: { net: 462, vat: 92.4, gross: 554.4 } },
      });
      const mechRow = report.sites.find(
        (row: { site: { id: string } }) => row.site.id === mech.site.id,
      );
      expect(mechRow.cells).toEqual({ MECH: { net: 231, vat: 46.2, gross: 277.2 } });
      expect(mechRow.lines).toHaveLength(2);
    },
  );

  test("an empty month has no rows", async ({ request }) => {
    const report = await (await request.get(`/api/reports/costs?month=${uniqueMonth()}`)).json();
    expect(report).toMatchObject({ invoiceCount: 0, sites: [], trades: [] });
  });

  test("rejects a month that is not YYYY-MM, with 400", async ({ request }) => {
    const response = await request.get("/api/reports/costs?month=2026-13");
    expect(response.status()).toBe(400);
  });

  test("exports the month's lines as CSV and as Excel", async ({ request, api }) => {
    const month = uniqueMonth();
    const invoice = await api.createInvoice(await api.createOrder(), { date: `${month}-28` });

    const csv = await request.get(`/api/reports/costs/export?month=${month}&format=csv`);
    expect(csv.headers()["content-type"]).toBe("text/csv; charset=utf-8");
    expect(csv.headers()["content-disposition"]).toBe(
      `attachment; filename="hire-costs-${month}.csv"`,
    );
    const text = await csv.text();
    expect(text.split("\r\n")[0]).toBe(
      "Site,Trade,Invoice,Invoice date,Description,Fleet code,Net,VAT,Gross",
    );
    expect(text).toContain(`,MECH,${invoice.number},${month}-28,Scissor lift 19ft electric,`);

    const xlsx = await request.get(`/api/reports/costs/export?month=${month}&format=xlsx`);
    const files = unzipSync(new Uint8Array(await xlsx.body()));
    expect(strFromU8(files["xl/workbook.xml"])).toContain(`<sheet name="Costs ${month}"`);
    expect(strFromU8(files["xl/worksheets/sheet2.xml"])).toContain(invoice.number);
  });

  test("exports a ZIP with a folder per site: its invoice PDFs and a summary", async ({
    request,
    api,
  }) => {
    const month = uniqueMonth();
    const order = await api.createOrder();
    const pdf = await pdfOf(despatchInvoice({ number: uniqueCode(8) }));
    const { uploadId, invoice: draft } = await api.extractPdf(pdf);
    const withPdf = await request.post("/api/invoices", {
      data: {
        ...draft,
        supplierId: order.supplier.id,
        jobNo: order.supplierJobNo,
        date: `${month}-28`,
        dueDate: undefined,
        uploadId,
      },
    });
    expect(withPdf.status()).toBe(201);
    const typedIn = await api.createInvoice(order, { date: `${month}-28` });

    const response = await request.get(`/api/reports/costs/export?month=${month}&format=zip`);

    expect(response.headers()["content-type"]).toBe("application/zip");
    const files = unzipSync(new Uint8Array(await response.body()));
    const folder = `${order.site.code} - ${order.site.name}`;
    const saved = await withPdf.json();
    expect(Object.keys(files).sort()).toEqual(
      [`hire-costs-${month}.csv`, `${folder}/${saved.number}.pdf`, `${folder}/summary.csv`].sort(),
    );
    expect(Buffer.from(files[`${folder}/${saved.number}.pdf`]).equals(Buffer.from(pdf))).toBe(true);
    const summary = strFromU8(files[`${folder}/summary.csv`]);
    expect(summary).toContain(`${saved.number},${month}-28,${saved.number}.pdf,`);
    expect(summary).toContain(`${typedIn.number},${month}-28,not uploaded,231.00,46.20,277.20`);
  });
});

test.describe("Yearly totals by site", () => {
  test("adds each site's invoices into its months", async ({ request, api }) => {
    const month = uniqueMonth();
    const [year, monthNumber] = month.split("-").map(Number);
    const order = await api.createOrder();
    await api.createInvoice(order, { date: `${month}-28` });

    const report = await (await request.get(`/api/reports/yearly?year=${year}`)).json();

    const row = report.sites.find((r: { site: { id: string } }) => r.site.id === order.site.id);
    expect(row.months[monthNumber - 1]).toEqual({ net: 231, vat: 46.2, gross: 277.2 });
    expect(row.total).toEqual({ net: 231, vat: 46.2, gross: 277.2 });

    const csv = await request.get(`/api/reports/yearly/export?year=${year}&format=csv`);
    expect((await csv.text()).split("\r\n")[0]).toBe(
      "Site,Site name,Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec,Net,VAT,Gross",
    );
  });

  test("rejects an export format it does not know, with 400", async ({ request }) => {
    const response = await request.get("/api/reports/yearly/export?year=2026&format=zip");
    expect(response.status()).toBe(400);
  });
});
