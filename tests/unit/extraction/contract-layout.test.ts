import { describe, expect, it } from "vitest";
import { extractInvoice } from "@/lib/extraction/extract-invoice";
import { contractCreditNote, contractInvoice, fragmentsOf } from "../../support/invoice-documents";

const read = (document: string) => extractInvoice(fragmentsOf(document));
const siteBlock = "BROOKFIELD BUILD LTD, CO:RIVERSIDE, 1 River Road, London SE1 9ZZ";

describe("contract layout", () => {
  it("reads an invoice: our order number, the contract, items with rates in the text", () => {
    expect(read(contractInvoice())).toEqual({
      layout: "contract",
      accountNo: "HT014",
      warnings: [],
      invoice: {
        number: "H512001",
        date: "2026-08-31",
        type: "CONTINUATION",
        isCreditNote: false,
        // "Order No" on this layout is our own order number, "Contract No." the supplier's job.
        orderRef: "PO-26-0101",
        jobNo: "C300101",
        lastInvoiceNo: "H511800",
        deliveryAddress: siteBlock,
        net: 525.64,
        vat: 105.13,
        gross: 630.77,
        lines: [
          {
            description: "6.4m working height electric scissor (0.76m wide)",
            fleetCode: "2201/17",
            qty: 1,
            periodFrom: "2026-08-01",
            periodTo: "2026-08-31",
            weeks: 4,
            days: 3,
            rate: 72,
            chargeType: "HIRE",
            net: 331.2,
            vat: 66.24,
          },
          {
            description: "Personnel hoist 2-person",
            fleetCode: "2207/3",
            qty: 1,
            periodFrom: "2026-08-01",
            periodTo: "2026-08-04",
            weeks: 0,
            days: 2,
            rate: 90,
            chargeType: "HIRE",
            net: 36,
            vat: 7.2,
          },
          {
            description: "All Risk Damage/Theft Waiver: Charged at 20% of the hire charge",
            qty: 1,
            chargeType: "DAMAGE_WAIVER",
            net: 73.44,
            vat: 14.69,
          },
          { description: "Collection", qty: 1, chargeType: "TRANSPORT", net: 85, vat: 17 },
        ],
      },
    });
  });

  it("reads the whole site block when the address beside it is printed at other heights", () => {
    // Our address on the left sits a few points lower than the site rows on the right, so it
    // forms rows of its own between them. Those rows must not end the site block.
    const fragments = fragmentsOf(contractInvoice()).map((fragment) =>
      fragment.x < 100 && fragment.y >= 750 && fragment.y <= 760
        ? { ...fragment, y: fragment.y - 4 }
        : fragment,
    );
    expect(extractInvoice(fragments)?.invoice.deliveryAddress).toBe(siteBlock);
  });

  it("calls the invoice a return when every item on it was off hired", () => {
    const allOffHired = contractInvoice().replace(
      "week for 4 weeks 3 days  (hire continues...)",
      "week for 4 weeks 3 days  (item off hired on 31/08/2026)",
    );
    expect(read(allOffHired)?.invoice.type).toBe("RETURN");
  });

  it("reads a credit note: lines without periods, amounts as credits", () => {
    expect(read(contractCreditNote())).toEqual({
      layout: "contract",
      accountNo: "HT014",
      warnings: [],
      invoice: {
        number: "H520050",
        date: "2026-09-30",
        type: "CONTINUATION",
        isCreditNote: true,
        orderRef: "PO-26-0101",
        jobNo: "C300101",
        deliveryAddress: siteBlock,
        net: -17.28,
        vat: -3.46,
        gross: -20.74,
        lines: [
          {
            description:
              "Partial Credit of Hire of 6.4m working height electric scissor (0.76m wide)",
            fleetCode: "2201/17",
            qty: 1,
            chargeType: "HIRE",
            net: -14.4,
            vat: -2.88,
          },
          {
            description:
              "Partial Credit of All Risk Damage/Theft Waiver: Charged at 20% of the hire charge",
            qty: 1,
            chargeType: "DAMAGE_WAIVER",
            net: -2.88,
            vat: -0.58,
          },
        ],
      },
    });
  });
});
