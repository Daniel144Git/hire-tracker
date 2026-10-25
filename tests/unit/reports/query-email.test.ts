import { describe, expect, it } from "vitest";
import { draftQueryEmail, type InvoiceToQuery } from "@/lib/reports/query-email";

const supplier = { name: "Apex Plant Hire", accountNo: "APX-000123" };

const finding = (overrides: Partial<InvoiceToQuery["findings"][number]> = {}) => ({
  check: "R2",
  severity: "HIGH" as const,
  linePosition: 1,
  message: "Billed from 2026-08-10, but delivered on 2026-08-13",
  difference: 22.5,
  resolved: false,
  ...overrides,
});

describe("draftQueryEmail: a query to the supplier from the open findings", () => {
  it("lists each invoice's open findings, what was overcharged and the total", () => {
    const email = draftQueryEmail(supplier, [
      {
        number: "APX-20819",
        date: "2026-08-31",
        findings: [
          finding(),
          finding({ check: "R12", severity: "LOW", message: "Rate differs from another order" }),
          finding({ check: "R1", resolved: true, message: "Already credited" }),
        ],
      },
      {
        number: "APX-20820",
        date: "2026-08-31",
        findings: [
          finding({
            check: "R8",
            severity: "HIGH",
            linePosition: 4,
            message:
              "Fleet code APX-GN-0099 is not on any hire order: are we paying for an item that is not on site?",
            difference: 120,
          }),
          finding({
            check: "R14",
            severity: "MEDIUM",
            linePosition: null,
            message: "Last invoice APX-20799 is not in Hire Tracker",
            difference: null,
          }),
        ],
      },
      { number: "APX-20905", date: "2026-09-05", findings: [] },
    ]);

    expect(email).toEqual({
      subject: "Query on 2 invoices, account APX-000123",
      body: [
        "Hello,",
        "",
        "We have checked these invoices against our hire records and have the following queries.",
        "",
        "Invoice APX-20819, 31/08/2026:",
        "- Line 1: Billed from 2026-08-10, but delivered on 2026-08-13. Overcharged by £22.50.",
        "",
        "Invoice APX-20820, 31/08/2026:",
        "- Line 4: Fleet code APX-GN-0099 is not on any hire order: are we paying for an item that is not on site? Overcharged by £120.00.",
        "- Last invoice APX-20799 is not in Hire Tracker.",
        "",
        "In total we believe we have been overcharged by £142.50. Please send a credit note for these amounts, or let us know why they are correct.",
        "",
        "Kind regards",
      ].join("\n"),
    });
  });

  it("names the invoice when there is one, and leaves out an unknown account", () => {
    const email = draftQueryEmail({ name: "Apex Plant Hire", accountNo: null }, [
      { number: "APX-20819", date: "2026-08-31", findings: [finding({ difference: 0 })] },
    ]);

    expect(email?.subject).toBe("Query on invoice APX-20819");
    expect(email?.body).toContain("Please explain these charges, or send a credit note.");
  });

  it("leaves out a job number we have no order for: that is about our records", () => {
    const email = draftQueryEmail(supplier, [
      {
        number: "APX-1",
        date: "2026-08-31",
        findings: [
          finding({
            check: "R8",
            severity: "MEDIUM",
            linePosition: null,
            message: "Job number J9 is not on any hire order",
            difference: null,
          }),
        ],
      },
    ]);
    expect(email).toBeNull();
  });

  it("has nothing to send when no finding is open", () => {
    expect(
      draftQueryEmail(supplier, [
        { number: "APX-1", date: "2026-08-31", findings: [finding({ resolved: true })] },
      ]),
    ).toBeNull();
  });
});
