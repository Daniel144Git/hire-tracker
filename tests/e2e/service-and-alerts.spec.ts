import { expect, test } from "./fixtures";

test.describe("Damage on site, query emails and alerts", () => {
  test("records damage on the site page and clears the charge's finding", async ({
    sitePage,
    api,
  }) => {
    const order = await api.createOrder();
    const invoice = await api.createInvoice(order, {
      date: "2026-09-12",
      type: "SALE",
      net: 85,
      vat: 17,
      gross: 102,
      lines: [{ description: "Guard rail damaged", chargeType: "OTHER", net: 85, vat: 17 }],
    });
    await sitePage.goto(order.site.id);

    await sitePage.eventForm.getByLabel("Date").fill("2026-09-08");
    await sitePage.eventForm.getByLabel("What happened").selectOption({ label: "Damage" });
    await sitePage.eventForm.getByLabel("Description").fill("Guard rail bent by a forklift");
    await sitePage.eventForm.getByRole("button", { name: "Record event" }).click();

    await expect(sitePage.eventForm.getByRole("status")).toHaveText(
      "Event recorded: the site's invoices were re-checked",
    );
    await expect(sitePage.eventsTable.getByRole("row")).toHaveCount(2);
    expect((await api.getInvoice(invoice.id)).findings.map((f) => f.check)).not.toContain("R9");
  });

  test(
    "drafts a query email on the invoice page, ready for the email app",
    { tag: "@smoke" },
    async ({ invoicePage, api, checkAccessibility }) => {
      const order = await api.createOrder();
      const invoice = await api.createInvoice(order, {
        date: "2026-09-12",
        type: "SALE",
        net: 85,
        vat: 17,
        gross: 102,
        lines: [{ description: "Guard rail damaged", chargeType: "OTHER", net: 85, vat: 17 }],
      });
      await invoicePage.goto(invoice.id);

      await invoicePage.queryEmail.getByText("Draft a query email to the supplier").click();

      await expect(invoicePage.queryEmail.getByLabel("Subject")).toHaveValue(
        `Query on invoice ${invoice.number}`,
      );
      await expect(invoicePage.queryEmail.getByLabel("Message")).toHaveValue(
        new RegExp(`Invoice ${invoice.number}, 12/09/2026:\\n- Line 1: Guard rail damaged`),
      );
      await expect(
        invoicePage.queryEmail.getByRole("link", { name: "Open in your email app" }),
      ).toHaveAttribute(
        "href",
        new RegExp(`^mailto:\\?subject=Query%20on%20invoice%20${invoice.number}`),
      );
      await checkAccessibility();
    },
  );

  test("lists hires to look at on the alerts page", async ({ page, api }) => {
    const site = await api.createSite();
    await api.createOrder({ site, overrides: { startDate: "2026-01-05" } });

    await page.goto("/alerts?asOf=2026-06-01");

    const rows = page
      .getByRole("table", { name: "Alerts" })
      .getByRole("row")
      .filter({ has: page.getByRole("rowheader", { name: site.code, exact: true }) });
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).getByRole("cell").first()).toHaveText("Long hire");
    await expect(rows.nth(1).getByRole("cell").first()).toHaveText("Costly");
  });
});
