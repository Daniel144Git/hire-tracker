import { describe, expect, it } from "vitest";
import { billedAfterOffHire } from "@/lib/reconciliation/checks/r01-billed-after-off-hire";
import { billedBeforeStart } from "@/lib/reconciliation/checks/r02-billed-before-start";
import { context, hireLine, invoice, order } from "./builders";

// A mobile platform at £35.00/week, delivered Thu 13 Aug and off-hired Thu 27 Aug, billed
// from Mon 10 Aug to Mon 31 Aug: 16 working days = 3 wks 1 day = £112.00.
// On hire: 13-27 Aug, 11 working days = £77.00. Overcharged in total: £35.00.
const platform = order({
  startDate: "2026-08-13",
  offHireDate: "2026-08-27",
  items: [
    { id: "item-1", description: "Mobile platform 3m", fleetCode: "APX-MP-0588", weeklyRate: 35 },
  ],
});
const ctx = context({
  orders: [platform],
  invoice: invoice({ lines: [hireLine({ periodFrom: "2026-08-10", net: 112, vat: 22.4 })] }),
});

describe("R1 and R2 on the same line", () => {
  it("each reports only its own part of the overcharge, so the parts add up to the total", () => {
    const [before] = billedBeforeStart(ctx);
    const [after] = billedAfterOffHire(ctx);

    // 10-12 Aug: 3 working days at £7.00 = £21.00. 28 and 31 Aug: 2 working days = £14.00.
    expect(before).toMatchObject({ check: "R2", expected: 91, difference: 21 });
    expect(after).toMatchObject({ check: "R1", expected: 98, difference: 14 });
    expect(before.difference! + after.difference!).toBe(35);
  });
});
