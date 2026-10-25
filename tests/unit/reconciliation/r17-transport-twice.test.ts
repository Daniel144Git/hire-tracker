import { describe, expect, it } from "vitest";
import { transportChargedTwice } from "@/lib/reconciliation/checks/r17-transport-twice";
import { context, hireLine, invoice, line } from "./builders";

const collection = (id: string, position: number, description = "Tower Collection") =>
  line({ id, position, chargeType: "TRANSPORT", description, net: 85 });

describe("R17: transport charged more than once on the same order", () => {
  it("flags a second collection charge on the same invoice", () => {
    const ctx = context({
      invoice: invoice({ lines: [hireLine(), collection("c1", 2), collection("c2", 3)] }),
    });

    expect(transportChargedTwice(ctx)).toEqual([
      expect.objectContaining({
        check: "R17",
        severity: "MEDIUM",
        invoiceLineId: "c2",
        message:
          "Collection charged more than once for job J100101: also on line 2 of this invoice",
        billed: 85,
        difference: 85,
      }),
    ]);
  });

  it("flags a collection already charged on an earlier invoice", () => {
    const earlier = invoice({
      id: "earlier",
      number: "INV-20700",
      date: "2026-08-14",
      lines: [collection("old", 1, "Collection of scissor lift")],
    });
    const ctx = context({
      invoice: invoice({ lines: [hireLine(), collection("c1", 2)] }),
      otherInvoices: [earlier],
    });

    expect(transportChargedTwice(ctx)[0].message).toBe(
      "Collection charged more than once for job J100101: also on INV-20700",
    );
  });

  it("does not count a transport supplement as a second charge", () => {
    // Some suppliers charge a supplement next to each delivery or collection.
    const ctx = context({
      invoice: invoice({
        lines: [collection("c1", 2), collection("s1", 3, "Transport Supplement Collection")],
      }),
    });

    expect(transportChargedTwice(ctx)).toEqual([]);
  });

  it("does not flag deliveries on different days: different trips", () => {
    const delivery = (id: string, position: number, date: string) => ({
      ...collection(id, position, "Transport Tools Delivery"),
      periodFrom: date,
      periodTo: date,
    });
    const ctx = context({
      invoice: invoice({
        lines: [delivery("d1", 2, "2026-01-22"), delivery("d2", 3, "2026-01-29")],
      }),
    });

    expect(transportChargedTwice(ctx)).toEqual([]);
  });

  it("flags the same delivery twice on the same day", () => {
    const delivery = (id: string, position: number) => ({
      ...collection(id, position, "Transport Tools Delivery"),
      periodFrom: "2026-01-22",
      periodTo: "2026-01-22",
    });
    const ctx = context({ invoice: invoice({ lines: [delivery("d1", 2), delivery("d2", 3)] }) });

    expect(transportChargedTwice(ctx).map((f) => f.invoiceLineId)).toEqual(["d2"]);
  });

  it("does not flag one delivery and one collection", () => {
    const ctx = context({
      invoice: invoice({ lines: [collection("d", 2, "Delivery"), collection("c", 3)] }),
    });

    expect(transportChargedTwice(ctx)).toEqual([]);
  });

  it("does not flag collections of different orders", () => {
    const ctx = context({
      invoice: invoice({
        lines: [collection("c1", 2), { ...collection("c2", 3), orderId: "order-2" }],
      }),
    });

    expect(transportChargedTwice(ctx)).toEqual([]);
  });

  it("does not flag the earlier invoice, nor count credit notes", () => {
    const later = invoice({
      id: "later",
      number: "INV-20900",
      date: "2026-09-30",
      lines: [collection("x", 1)],
    });
    const credit = invoice({
      id: "credit",
      number: "C-1",
      date: "2026-08-01",
      isCreditNote: true,
      lines: [collection("y", 1)],
    });
    const ctx = context({
      invoice: invoice({ lines: [collection("c1", 1)] }),
      otherInvoices: [later, credit],
    });

    expect(transportChargedTwice(ctx)).toEqual([]);
  });
});
