import { describe, expect, it } from "vitest";
import { toFormValues } from "@/lib/extraction/form-values";

describe("toFormValues", () => {
  it("flattens a read invoice into the invoice form's fields", () => {
    const values = toFormValues(
      {
        number: "30451207",
        date: "2026-08-31",
        type: "CONTINUATION",
        isCreditNote: true,
        jobNo: "170200345",
        net: -26.4,
        vat: -5.28,
        gross: -31.68,
        lines: [
          {
            description: "Scissor lift",
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
      },
      "supplier-1",
    );
    expect(values).toEqual({
      supplierId: "supplier-1",
      number: "30451207",
      date: "2026-08-31",
      type: "CONTINUATION",
      isCreditNote: "on",
      jobNo: "170200345",
      net: "-26.4",
      vat: "-5.28",
      gross: "-31.68",
      "lines.0.description": "Scissor lift",
      "lines.0.fleetCode": "APX-SL-0042",
      "lines.0.qty": "1",
      "lines.0.periodFrom": "2026-08-31",
      "lines.0.periodTo": "2026-08-28",
      "lines.0.weeks": "0",
      "lines.0.days": "1",
      "lines.0.rate": "120",
      "lines.0.chargeType": "HIRE",
      "lines.0.net": "-24",
      "lines.0.vat": "-4.8",
      "lines.1.description": "Damage Waiver",
      "lines.1.qty": "1",
      "lines.1.chargeType": "DAMAGE_WAIVER",
      "lines.1.net": "-2.4",
      "lines.1.vat": "-0.48",
    });
  });

  it("leaves out the supplier and the credit-note box when they are not known", () => {
    const values = toFormValues({ isCreditNote: false, lines: [] }, null);
    expect(values).toEqual({});
  });
});
