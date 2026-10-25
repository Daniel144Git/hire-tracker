import { expect, test } from "./fixtures";

// The one API test that reads the seed instead of creating its own data: it proves the demo
// data still gives every implemented check something to find (brief, section 6).
const IMPLEMENTED_CHECKS = [
  "R1",
  "R2",
  "R3",
  "R4",
  "R5",
  "R6",
  "R7",
  "R8",
  "R10",
  "R12",
  "R13",
  "R14",
  "R15",
  "R16",
  "R17",
];

test(
  "the demo data has an example for every implemented check",
  { tag: "@smoke" },
  async ({ request }) => {
    const found = new Set<string>();
    for (const month of ["2026-07", "2026-08", "2026-09"]) {
      const report = await (await request.get(`/api/reports/discrepancies?month=${month}`)).json();
      for (const finding of report.findings) {
        if (finding.supplier.name === "Apex Plant Hire") found.add(finding.check);
      }
      for (const gap of report.missingPeriods) {
        if (["J100101", "J100301"].includes(gap.supplierJobNo)) found.add(gap.check);
      }
    }

    expect([...found].sort()).toEqual([...IMPLEMENTED_CHECKS].sort());
  },
);

test("the demo credit note closes the R1 finding it credits", async ({ request }) => {
  const report = await (await request.get("/api/reports/discrepancies?month=2026-08")).json();

  const credited = report.findings.filter(
    (f: { check: string; resolution: string | null }) =>
      f.check === "R1" && f.resolution === "Credited on C-20901",
  );
  expect(credited).toHaveLength(2);
});
