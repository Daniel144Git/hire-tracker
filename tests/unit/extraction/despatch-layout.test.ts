import { describe, expect, it } from "vitest";
import { extractInvoice } from "@/lib/extraction/extract-invoice";
import {
  despatchCreditNote,
  despatchDamageCharge,
  despatchInvoice,
  despatchReturnInvoice,
  fragmentsOf,
} from "../../support/invoice-documents";

const read = (document: string) => extractInvoice(fragmentsOf(document));

describe("despatch layout", () => {
  it("reads a continuation invoice: header, hire line with its fleet code, damage waiver", () => {
    expect(read(despatchInvoice())).toEqual({
      layout: "despatch",
      accountNo: "APX-000123",
      warnings: [],
      invoice: {
        number: "30451207",
        date: "2026-08-31",
        dueDate: "2026-09-30",
        type: "CONTINUATION",
        isCreditNote: false,
        // "Our Ref" on this layout is the supplier's job number, "Your Ref" is ours.
        jobNo: "170200345",
        customerRef: "Riverside",
        lastInvoiceNo: "30390001",
        deliveryAddress: "Brookfield Build Ltd, Riverside Tower, 1 River Road, London SE1 9ZZ",
        net: 554.4,
        vat: 110.88,
        gross: 665.28,
        lines: [
          {
            description: "Scissor lift 8m electric",
            fleetCode: "APX-SL-0042",
            qty: 1,
            periodFrom: "2026-08-01",
            periodTo: "2026-08-31",
            weeks: 4,
            days: 1,
            rate: 120,
            chargeType: "HIRE",
            net: 504,
            vat: 100.8,
          },
          {
            description: "Damage Waiver",
            qty: 1,
            chargeType: "DAMAGE_WAIVER",
            net: 50.4,
            vat: 10.08,
          },
        ],
      },
    });
  });

  it("reads a return invoice with two despatch notes, transport and quantities", () => {
    const result = read(despatchReturnInvoice());
    expect(result?.invoice).toMatchObject({
      number: "30451300",
      type: "RETURN",
      customerRef: "NORTHGATE WORKS",
      deliveryAddress: "Brookfield Build Ltd, Northgate Works, Leeds LS1 4AB",
      net: 47,
      vat: 9.4,
      gross: 56.4,
    });
    expect(result?.invoice.lines).toEqual([
      {
        description: "Material lift 5m",
        fleetCode: "M1001-2002R",
        qty: 1,
        periodFrom: "2026-09-01",
        periodTo: "2026-09-02",
        weeks: 0,
        days: 1,
        rate: 60,
        chargeType: "HIRE",
        net: 12,
        vat: 2.4,
      },
      { description: "Transport Collection", qty: 1, chargeType: "TRANSPORT", net: 25, vat: 5 },
      {
        description: "Pipe stand roller head",
        fleetCode: "M1001-3003",
        qty: 2,
        periodFrom: "2026-09-01",
        periodTo: "2026-09-02",
        weeks: 0,
        days: 2,
        rate: 10,
        chargeType: "HIRE",
        net: 8,
        vat: 1.6,
      },
      { description: "Damage Waiver", qty: 1, chargeType: "DAMAGE_WAIVER", net: 2, vat: 0.4 },
    ]);
    expect(result?.warnings).toEqual([]);
  });

  it("reads a suspension credit under an item as a negative hire line for the same item", () => {
    const document = despatchInvoice().replace(
      "         Ecode: APX-SL-0042\n",
      "         Ecode: APX-SL-0042\n" +
        "         Free days  1wk Hire Suspension 10/08/26 to 14/08/26 (5 Days)per day        120.00-\n",
    );
    expect(read(document)?.invoice.lines[1]).toEqual({
      description: "Free days 1wk Hire Suspension 10/08/26 to 14/08/26 (5 Days)per day",
      fleetCode: "APX-SL-0042",
      qty: 1,
      chargeType: "HIRE",
      net: -120,
      vat: -24,
    });
  });

  it("reads a credit note as negative amounts and keeps the period as printed", () => {
    const result = read(despatchCreditNote());
    expect(result?.invoice).toEqual({
      number: "30460001",
      date: "2026-09-30",
      type: "RETURN",
      isCreditNote: true,
      jobNo: "170200345",
      customerRef: "Riverside",
      lastInvoiceNo: "30451207",
      net: -26.4,
      vat: -5.28,
      gross: -31.68,
      lines: [
        {
          description: "Scissor lift 8m electric",
          fleetCode: "APX-SL-0042",
          qty: 1,
          periodFrom: "2026-08-31",
          periodTo: "2026-08-28",
          weeks: 0,
          days: 1,
          rate: 120,
          chargeType: "HIRE",
          net: -24,
          vat: -4.8,
        },
        {
          description: "Damage Waiver",
          qty: 1,
          chargeType: "DAMAGE_WAIVER",
          net: -2.4,
          vat: -0.48,
        },
      ],
    });
    expect(result?.warnings).toEqual([]);
  });

  it("reads a damage charge as a sale outside the scope of VAT", () => {
    const result = read(despatchDamageCharge());
    expect(result?.invoice).toMatchObject({
      type: "SALE",
      deliveryAddress: "Brookfield Build Ltd, Riverside Tower",
      net: 84.5,
      vat: 0,
      gross: 84.5,
      lines: [
        {
          description: "Parts - asset damaged beyond repair",
          qty: 1,
          chargeType: "OTHER",
          net: 84.5,
          vat: 0,
        },
      ],
    });
    expect(result?.warnings).toEqual([]);
  });
});
