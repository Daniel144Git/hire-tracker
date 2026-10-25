import { itemData, julyLine } from "../support/test-data";
import { expect, test } from "./fixtures";

// Checks that compare an invoice with the job's earlier invoices, other orders or the site.
// The orders here start on 1 July 2026, so July and August can both be billed.
const july = { date: "2026-07-31" };

test.describe("Checks across invoices, orders and sites", () => {
  test("R6: a weekly rate that changed since last month", async ({ api }) => {
    const order = await api.createOrder({ overrides: { startDate: "2026-07-01" } });
    const fleetCode = order.items[0].fleetCode;
    await api.createInvoice(order, {
      ...july,
      net: 230,
      vat: 46,
      gross: 276,
      lines: [julyLine(fleetCode)],
    });

    // August at £52.50/week: 4 wks 1 day = £220.50, damage waiver £22.05.
    const august = await api.createInvoice(order, {
      net: 242.55,
      vat: 48.51,
      gross: 291.06,
      lines: [
        {
          ...julyLine(fleetCode),
          periodFrom: "2026-08-01",
          periodTo: "2026-08-31",
          net: 220.5,
          vat: 44.1,
        },
        { description: "Damage waiver", chargeType: "DAMAGE_WAIVER", net: 22.05, vat: 4.41 },
      ],
    });

    expect(august.findings).toEqual([
      expect.objectContaining({
        check: "R6",
        message: expect.stringContaining("Billed at £52.50/week, but £50.00/week on"),
        difference: 10.5,
      }),
    ]);
  });

  test("R8: a fleet code that is on no hire order", async ({ api }) => {
    const order = await api.createOrder();

    const invoice = await api.createInvoice(order, {
      net: 100,
      vat: 20,
      gross: 120,
      lines: [
        {
          description: "Generator",
          fleetCode: "APX-ZZ-0000",
          chargeType: "HIRE",
          net: 100,
          vat: 20,
        },
      ],
    });

    expect(invoice.findings.map((f) => [f.check, f.severity])).toContainEqual(["R8", "HIGH"]);
  });

  test("R12: the same item type at a different rate on another order", async ({ api }) => {
    const supplier = await api.createSupplier();
    const adaptor = (weeklyRate: number) =>
      itemData({ description: "Outrigger adaptor", weeklyRate });
    const order = await api.createOrder({ supplier, overrides: { items: [adaptor(3.75)] } });
    const other = await api.createOrder({ supplier, overrides: { items: [adaptor(3.5)] } });

    const invoice = await api.createInvoice(order, {
      net: 17.33,
      vat: 3.47,
      gross: 20.8,
      lines: [
        {
          ...julyLine(order.items[0].fleetCode),
          description: "Outrigger adaptor",
          periodFrom: "2026-08-01",
          periodTo: "2026-08-31",
          net: 15.75,
          vat: 3.15,
        },
        { description: "Damage waiver", chargeType: "DAMAGE_WAIVER", net: 1.58, vat: 0.32 },
      ],
    });

    expect(invoice.findings).toEqual([
      expect.objectContaining({
        check: "R12",
        severity: "LOW",
        message: `Outrigger adaptor is hired at £3.75/week here but at £3.50/week on job ${other.supplierJobNo}`,
      }),
    ]);
  });

  test("R14: a 'last invoice' we do not hold, repaired when that invoice is entered", async ({
    api,
  }) => {
    const order = await api.createOrder({ overrides: { startDate: "2026-07-01" } });
    const august = await api.createInvoice(order, { lastInvoiceNo: "INV-JULY-001" });
    expect(august.findings.map((f) => f.message)).toEqual([
      "Last invoice INV-JULY-001 is not in Hire Tracker: ask the supplier for a copy",
    ]);

    await api.createInvoice(order, {
      ...july,
      number: "INV-JULY-001",
      net: 230,
      vat: 46,
      gross: 276,
      lines: [julyLine(order.items[0].fleetCode)],
    });

    expect((await api.getInvoice(august.id)).findings).toEqual([]);
  });

  test("R15: an item billed last month that is gone, with no return invoice", async ({ api }) => {
    const order = await api.createOrder({
      overrides: {
        startDate: "2026-07-01",
        items: [itemData(), itemData({ description: "Pipe groover 2-6in", weeklyRate: 41.29 })],
      },
    });
    const [lift, groover] = order.items;
    await api.createInvoice(order, {
      ...july,
      net: 419.93,
      vat: 83.99,
      gross: 503.92,
      lines: [
        julyLine(lift.fleetCode),
        julyLine(groover.fleetCode, { description: "Pipe groover 2-6in", net: 189.93, vat: 37.99 }),
      ],
    });

    const august = await api.createInvoice(order);

    expect(august.findings).toEqual([
      expect.objectContaining({
        check: "R15",
        severity: "MEDIUM",
        message: expect.stringContaining(`${groover.fleetCode} was billed on INV-`),
      }),
    ]);
  });

  test("R17: the same collection charged twice on one invoice", async ({ api }) => {
    const order = await api.createOrder();

    const invoice = await api.createInvoice(order, {
      net: 401,
      vat: 80.2,
      gross: 481.2,
      lines: [
        {
          ...julyLine(order.items[0].fleetCode),
          periodFrom: "2026-08-01",
          periodTo: "2026-08-31",
          net: 210,
          vat: 42,
        },
        { description: "Tower Collection", chargeType: "TRANSPORT", net: 85, vat: 17 },
        { description: "Tower Collection", chargeType: "TRANSPORT", net: 85, vat: 17 },
        { description: "Damage waiver", chargeType: "DAMAGE_WAIVER", net: 21, vat: 4.2 },
      ],
    });

    expect(invoice.findings).toEqual([
      expect.objectContaining({
        check: "R17",
        linePosition: 3,
        message: `Collection charged more than once for job ${order.supplierJobNo}: also on line 2 of this invoice`,
      }),
    ]);
  });
});
