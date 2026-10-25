import { describe, expect, it } from "vitest";
import { expectedDamageWaiver, type WaiverableLine } from "@/lib/charging/damage-waiver";

function hire(net: number, damageWaiverApplies = true): WaiverableLine {
  return { chargeType: "HIRE", net, damageWaiverApplies };
}

describe("expectedDamageWaiver: one line per invoice, a % of the hire charges", () => {
  it("charges 10% of all hire lines: 10% of £210.00 + £130.00 = £34.00", () => {
    expect(expectedDamageWaiver([hire(210), hire(130)], 10)).toBe(34);
  });

  it("is not applied to transport", () => {
    const lines: WaiverableLine[] = [
      hire(210),
      { chargeType: "TRANSPORT", net: 85, damageWaiverApplies: true },
    ];
    expect(expectedDamageWaiver(lines, 10)).toBe(21);
  });

  it("leaves out hire lines of orders flagged as exempt from damage waiver", () => {
    expect(expectedDamageWaiver([hire(210), hire(130, false)], 10)).toBe(21);
  });

  it("rounds to the penny: 10% of £41.25 is £4.125, charged as £4.13", () => {
    expect(expectedDamageWaiver([hire(41.25)], 10)).toBe(4.13);
  });

  it("adds the hire lines first and rounds once: 10% of £15.75 + £8.26 + £24.77 = £4.88", () => {
    expect(expectedDamageWaiver([hire(15.75), hire(8.26), hire(24.77)], 10)).toBe(4.88);
  });

  it("gives a negative waiver on a credit note, mirroring the charge: -£41.25 gives -£4.13", () => {
    expect(expectedDamageWaiver([hire(-41.25)], 10)).toBe(-4.13);
  });

  it("is £0.00 when no line qualifies", () => {
    const transportOnly: WaiverableLine[] = [
      { chargeType: "TRANSPORT", net: 85, damageWaiverApplies: true },
    ];
    expect(expectedDamageWaiver(transportOnly, 10)).toBe(0);
    expect(expectedDamageWaiver([], 10)).toBe(0);
  });

  it("is £0.00 when the supplier's damage waiver is 0%", () => {
    expect(expectedDamageWaiver([hire(210)], 0)).toBe(0);
  });

  it.each([-1, 101, Number.NaN])("rejects a damage waiver percentage of %s", (percent) => {
    expect(() => expectedDamageWaiver([hire(210)], percent)).toThrow(RangeError);
  });
});
