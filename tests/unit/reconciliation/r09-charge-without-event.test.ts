import { describe, expect, it } from "vitest";
import { chargeWithoutEvent } from "@/lib/reconciliation/checks/r09-charge-without-event";
import type { CheckServiceEvent } from "@/lib/reconciliation/types";
import { context, invoice, line, order } from "./builders";

const damage = line({
  chargeType: "OTHER",
  description: "Guard rail damaged beyond repair",
  net: 85,
  orderId: "order-1",
});

const event = (overrides: Partial<CheckServiceEvent> = {}): CheckServiceEvent => ({
  siteId: "site-1",
  date: "2026-08-20",
  kind: "DAMAGE",
  fleetCode: null,
  ...overrides,
});

describe("R9: a damage, loss, repair or service charge with no event recorded on site", () => {
  it("flags a charge when nothing was recorded on the site", () => {
    const ctx = context({ invoice: invoice({ lines: [damage] }) });

    expect(chargeWithoutEvent(ctx)).toEqual([
      expect.objectContaining({
        check: "R9",
        severity: "MEDIUM",
        invoiceLineId: "line-other",
        message:
          "Guard rail damaged beyond repair charged at £85.00, but no service, repair, damage or loss is recorded on RVS in the 60 days before the invoice: ask for the damage report or the site's confirmation",
        billed: 85,
      }),
    ]);
  });

  it.each([
    ["on the day of the invoice", "2026-08-31"],
    ["60 days before", "2026-07-02"],
    ["a week after, recorded late", "2026-09-07"],
  ])("accepts an event on the site %s", (_when, date) => {
    const ctx = context({
      invoice: invoice({ lines: [damage] }),
      serviceEvents: [event({ date })],
    });

    expect(chargeWithoutEvent(ctx)).toEqual([]);
  });

  it.each([
    ["61 days before", { date: "2026-07-01" }],
    ["8 days after", { date: "2026-09-08" }],
    ["on another site", { siteId: "site-ngw" }],
    ["for another item", { fleetCode: "APX-ZZ-9" }],
  ])("does not accept an event %s", (_case, overrides) => {
    const charge = { ...damage, fleetCode: "APX-SL-1042" };
    const ctx = context({
      invoice: invoice({ lines: [charge] }),
      serviceEvents: [event(overrides)],
    });

    expect(chargeWithoutEvent(ctx)).toHaveLength(1);
  });

  it("finds the site from the invoice when the line has no order", () => {
    const unlinked = { ...damage, orderId: null };
    const ctx = context({
      invoice: invoice({ siteId: "site-1", lines: [unlinked] }),
      serviceEvents: [event()],
    });

    expect(chargeWithoutEvent(ctx)).toEqual([]);
  });

  it("says so, as low, when the site is not known: that is our records' gap", () => {
    const unlinked = { ...damage, orderId: null };
    const ctx = context({ invoice: invoice({ lines: [unlinked] }) });

    expect(chargeWithoutEvent(ctx)[0].severity).toBe("LOW");
    expect(chargeWithoutEvent(ctx)[0].message).toBe(
      "Guard rail damaged beyond repair charged at £85.00, but the site is not known, so no service, repair, damage or loss can be matched: link the invoice to a site",
    );
  });

  it("ignores hire, transport and sale lines, credits and credit notes", () => {
    const ctx = context({
      invoice: invoice({
        lines: [
          line({ chargeType: "TRANSPORT", net: 45 }),
          line({ chargeType: "SALE", net: 12 }),
          { ...damage, id: "credit-line", net: -85, vat: -17 },
        ],
      }),
    });
    expect(chargeWithoutEvent(ctx)).toEqual([]);

    const creditNote = context({ invoice: invoice({ isCreditNote: true, lines: [damage] }) });
    expect(chargeWithoutEvent(creditNote)).toEqual([]);
  });

  it("uses the site of the line's order", () => {
    const ngwOrder = order({ id: "order-ngw", site: { id: "site-ngw", code: "NGW" } });
    const ctx = context({
      orders: [order(), ngwOrder],
      invoice: invoice({ lines: [{ ...damage, orderId: "order-ngw" }] }),
      serviceEvents: [event({ siteId: "site-ngw" })],
    });

    expect(chargeWithoutEvent(ctx)).toEqual([]);
  });
});
