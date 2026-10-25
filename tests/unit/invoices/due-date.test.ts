import { describe, expect, it } from "vitest";
import { calculateDueDate } from "@/lib/invoices/due-date";

const endOfNextMonth = { paymentTerms: "END_OF_NEXT_MONTH" as const };

describe("calculateDueDate", () => {
  describe("END_OF_NEXT_MONTH: the last calendar day of the month after the invoice date", () => {
    it.each([
      ["2026-08-31", "2026-09-30", "the brief's example: invoice 31/08 is due 30/09"],
      ["2026-09-16", "2026-10-31", "the brief's example: invoice 16/09 is due 31/10"],
      ["2026-01-31", "2026-02-28", "February in a normal year"],
      ["2028-01-10", "2028-02-29", "February in a leap year"],
      ["2027-12-15", "2028-01-31", "an invoice in December is due in January next year"],
      ["2026-12-31", "2027-01-31", "the last day of the year"],
    ])("invoice dated %s is due %s (%s)", (invoiceDate, dueDate) => {
      expect(calculateDueDate(invoiceDate, endOfNextMonth)).toBe(dueDate);
    });
  });

  describe("NET_N: N calendar days after the invoice date", () => {
    it.each([
      ["2026-08-31", 30, "2026-09-30"],
      ["2026-12-15", 30, "2027-01-14"],
      ["2028-02-20", 14, "2028-03-05"],
    ])("invoice dated %s with %i days is due %s", (invoiceDate, days, dueDate) => {
      expect(calculateDueDate(invoiceDate, { paymentTerms: "NET_N", paymentTermsDays: days })).toBe(
        dueDate,
      );
    });

    it("fails when NET_N has no number of days", () => {
      expect(() =>
        calculateDueDate("2026-08-31", { paymentTerms: "NET_N", paymentTermsDays: null }),
      ).toThrow(RangeError);
    });
  });
});
