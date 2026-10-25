# Hire Tracker: project brief

## 1. The problem

A building-services contractor hires equipment for its construction sites: scissor lifts, mobile platforms, pipe groovers, tools, each with accessories. The hire company sends invoices every month for everything still on hire ("continuation" invoices) and a final invoice when an item goes back ("return" invoices). Some invoices are for maintenance or service visits, transport, damage or consumables.

Today all of this lives in a spreadsheet: one tab per site, every invoice line typed in by hand (order number, start of hire, item, fleet code, quantity, invoice number and date, type, value, VAT, billing period, end of hire, collection number), plus a cost-allocation tab per month that splits the costs by trade, and a yearly totals tab.

The spreadsheet records what was billed, but it doesn't **check** it. The team wants to know, every month:

- Are we being charged for items after they went off hire or were collected?
- Is any period billed twice, or is a month missing?
- Did the rate change without anyone agreeing to it?
- Were we charged for a service or maintenance visit that didn't happen?
- What is on hire on each site right now, since when, and how much has each item cost so far?
- What did each site cost this month, split by trade, with totals that match the invoices to the penny?
- Which invoices are due this week, which are overdue, and does the supplier's statement match what we have?

Hire Tracker replaces the spreadsheet and answers those questions automatically.

The project is inspired by real procurement work, but **all data in this repo is fictional**.

## 2. Core concepts

- **Site**: a construction site (code + name), e.g. `RVS - Riverside Tower`.
- **Hire order**: one hire of one main item on one site. Has an order number, start of hire, end of hire (off-hire date), collection number, trade, agreed rate.
- **Hire item**: the main item (description, fleet code, quantity) and its **accessories** (extra fleet codes billed with it).
- **Invoice**: number, date, supplier, type (`CONTINUATION`, `RETURN`, `SERVICE`, `TRANSPORT`, `DAMAGE`, `CREDIT_NOTE`), net, VAT, gross, attached PDF.
- **Invoice line**: links an invoice to a hire order, with billing period (from - to), charge type, net, VAT.
- **Service event**: a maintenance or inspection visit recorded on site (date, item, what was done, who confirmed it).
- **Trades**: `MECH`, `ELEC`, `VENT`, `BMS` (configurable).

## 3. Scope

### MVP (phases 0-4)

1. Sites, hire orders and items (with accessories): create, edit, off-hire, record collection.
2. Invoices and invoice lines: manual entry, lines linked to orders by order number / fleet code.
3. **Charge calculator**: given an order's agreed rate and the supplier's charging rules, the expected charge for any period.
4. **Reconciliation engine**: runs on every invoice and flags discrepancies (section 4.2).
5. Discrepancy report per invoice and per month: billed vs expected, the reason, and the amount at stake.
6. On-hire register per site: what is on hire now, days on hire, cost to date.
7. Due-date and payment tracking: due in 7/14 days, overdue, paid/unpaid/queried per invoice.

### Later (phases 5-8)

8. Upload invoice PDF, AI extraction of the lines (mock in tests, an AI API for real use), review screen. Statement import and R11.
9. Monthly cost allocation per site and trade, yearly totals per site (the current spreadsheet's report tabs), CSV/Excel export. The monthly export also groups the invoice PDFs by site: a ZIP with one folder per site (e.g. `RVS - Riverside Tower/`), each holding that site's invoices and a CSV summary (requested by Florin; Google Drive folders are an option if the connector is set up).
10. Service events and the "service billed but not recorded" check.
11. Draft a query email to the hire company from the discrepancy report.
12. Alerts: item on hire longer than N days, cost to date above a threshold (time to off-hire or buy).
13. Optional: Java API test module (RestAssured + JUnit 5) in CI; roles (admin / site manager); Monday.com sync behind an interface.

### Out of scope

Payments, accounting ledger, email ingestion, multiple companies.

## 4. Business rules

### 4.1 Charging rules

These rules were confirmed against real invoices (figures below are fictional). They are the default supplier profile; other profiles (daily rate, calendar days, minimum charge) stay configurable but are not needed for the MVP.

**Working-day weekly rate (default profile):**

- Each item has a **rate per week**, where a week = **5 working days** (Mon-Fri). Weekends are not charged. No minimum hire period.
- Chargeable days for a billing period = number of working days from `periodFrom` to `periodTo` **inclusive**.
- `weeks = floor(days / 5)`, `extraDays = days mod 5`.
- `lineCharge = round2(weeks × rate + extraDays × (rate / 5))`. The invoice prints the period as "N wks M days".
- Worked example, rate £50.00/week: 01/08/2026 (Sat) to 31/08/2026 (Mon) has 21 working days = 4 wks 1 day = 4 × 50.00 + 1 × 10.00 = **£210.00**. A delivery on 13/08/2026 (Thu) billed to 31/08 has 13 working days = 2 wks 3 days = 100.00 + 30.00 = **£130.00**.
- **Minimum charge of 1 week** per item on a new hire: an item delivered and returned within the same week (2, 3 or 4 working days) is billed a full week. After the first week everything is pro-rata.
- **Hire suspensions**: the supplier can credit "free days" for a closed site (e.g. 10 working days) as a negative sub-line under each hire line of that month. The app records suspensions per site and period and checks that the credit appears on **every** order on that site (R16).
- **Loss and damage charges**: lost accessories ("Loss Charges") and repairs ("Damage Charges", type `Workshop`) are invoiced outside VAT scope (0%). The `Return` type is also used for loss-charge invoices, so a Return invoice does not by itself mean the hire ended: only a Return with hire lines does.
- **Continuation** invoices are issued on the last day of each month for the whole calendar month (or from the delivery date in the first month). A **return** (off-hire) invoice covers from the 1st of the month to the off-hire date.
- UK bank holidays: open question, most likely still charged as working days. Make it a supplier flag; test both.

**Implementation decisions (Phase 1, `src/lib/charging`):**

- Dates are plain `YYYY-MM-DD` strings and all day arithmetic is done in UTC, so the result does not depend on the machine's time zone or on daylight-saving changes.
- The expected charge of a line only counts the days the item was on hire: the billing period is cut to start no earlier than the start of hire and to end no later than the off-hire date. Anything billed outside that window is what R1 and R2 report.
- One-week minimum: it applies to the whole hire. When a hire shorter than `minChargeDays` working days ends inside a billing period, the missing days are added to that period, i.e. to the off-hire (return) invoice. Example: on hire Thu 30 Jul to Tue 4 Aug, July is billed 2 days and August 3 days, one week in total. To be confirmed against a real return invoice of a short hire.
- Rounding: the line charge for one item is rounded once, `round2(weeks × rate + days × rate / 5)`, then multiplied by the quantity and rounded again. Damage waiver adds the qualifying hire lines first and rounds once. Rounding is half away from zero, so credits mirror charges.
- Bank holidays are a supplier flag (`chargeBankHolidays`) with the list of dates passed in; both settings are tested.

**Other charges on the same invoice:**

- **Damage waiver**: a percentage (e.g. 10%) of the hire charges on that invoice, one line per invoice, rounded to the penny. Not applied to transport. It applies to most orders but not all (some plant categories have none), so it is a per-order flag `damageWaiverApplies`, defaulting to the supplier's setting.
- Lines can have quantity > 1 (e.g. 4 identical scissor lifts) without individual fleet codes; the charge is qty × line charge.
- **Transport**: delivery and collection charges as fixed lines on the first and last invoice.
- Each line has its own quantity, description, **fleet code** (the physical item's id), period, "wks/days", rate and total.

**Invoice structure (what the extractor must read):**

- Header: invoice number, invoice date, due date (30 days), supplier's **job/contract number** (one per hire order; stays the same on every monthly invoice of that order), customer reference (free text naming the site, inconsistently spelt), **type** (`Continuation` / `Return` / `Sale`), **last invoice number** (links the chain of a hire order), account number.
- Body: one or more **despatch** blocks (despatch number + delivery date + delivery address + site contact), each with its hire lines; then damage waiver and transport lines; then VAT summary and totals.
- The customer reference must be normalised to a `Site` (aliases: "RIVERSIDE", "Riverside Tower", "riverside" → one site), and the delivery address is a second signal.

**Returns, credits and off-hire (confirmed on real documents):**

- A **Return** invoice is issued when an item comes off hire. It is dated around the collection (often a week or more later), covers the 1st of the month to the off-hire date, and carries the collection transport lines dated on the collection day. Its "last invoice" points to the previous continuation of the same job number.
- The supplier bills the whole month on the continuation invoice even when the item went off hire a few days earlier, then issues a **credit note** (type `Return`, separate "C" number) for the over-billed working days at the same rate, with a negative damage-waiver line. The credit's period can be printed with From later than To (e.g. "31/08 to 27/08"); the extractor must accept that and treat the days as a credit.
- So R1 has two outcomes: an overcharge the supplier has **not** credited (raise a query), and one already credited (match the credit to the finding and close it).
- The **off-hire date** and the **collection number** are not printed on the invoices. They come from the supplier's off-hire confirmation and are **entered by the user on the hire order** (today the "Collection No" column of the spreadsheet). That entry is what every R1/R15 check compares against, so the UI makes it a one-click action on the on-hire register: "off-hire this item: date + collection no".
- **Due date**: the last calendar day of the month following the invoice date (invoice 31/08 → due 30/09; invoice 16/09 → due 31/10). Payment terms are a supplier setting: `END_OF_NEXT_MONTH` (default) or `NET_N`.

**Statement reconciliation works in practice:** a dry run over eight months of real documents found a whole month of invoices (about 30) present on the supplier statements but never saved in the folders, plus a duplicated archive. R11 is not theoretical.

**Supplier statement:** a monthly statement lists every invoice (date, job number, invoice number, customer reference, amount), and an "outstanding" spreadsheet lists what is unpaid with due dates. Both are inputs for check R11.

### 4.2 Reconciliation checks

Each check produces a finding with severity, reason, billed amount, expected amount and difference.

| #   | Check                                                                                                                                                                                                                                                                                    | Example finding                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| R1  | Billed after end of hire or after collection; closed automatically when a matching credit note arrives                                                                                                                                                                                   | Order 1001 off-hired 12/06, line billed to 30/06: 12 working days overcharged, no credit received |
| R2  | Billed before start of hire                                                                                                                                                                                                                                                              |                                                                                                   |
| R3  | Same order billed twice for overlapping days                                                                                                                                                                                                                                             | 01/05-31/05 appears on two invoices                                                               |
| R4  | Missing period: no invoice for a month while the item was on hire                                                                                                                                                                                                                        | Possible late invoice, plan for it                                                                |
| R5  | Amount differs from expected (agreed rate × chargeable units) beyond tolerance                                                                                                                                                                                                           | Billed £412.80, expected £398.40                                                                  |
| R6  | Rate drift: same order, same length of period, different price from last month                                                                                                                                                                                                           |                                                                                                   |
| R7  | Continuation invoice after a return invoice for the same order                                                                                                                                                                                                                           |                                                                                                   |
| R8  | Fleet code on the invoice not on any open order, or on a different site                                                                                                                                                                                                                  |                                                                                                   |
| R9  | Service / maintenance charge with no matching service event                                                                                                                                                                                                                              |                                                                                                   |
| R10 | VAT on a line ≠ round(net × VAT rate, 2), or invoice lines don't add up to the invoice total                                                                                                                                                                                             |                                                                                                   |
| R11 | Statement reconciliation: an invoice on the supplier statement is missing from our records (never received), or the amount differs, or we hold an invoice that is not on the statement                                                                                                   | Invoice 123 on the statement for £336.19, not in Hire Tracker: ask for a copy                     |
| R12 | Same item type hired at different weekly rates on different orders (rate inconsistency across orders)                                                                                                                                                                                    | Adaptor at £3.50/week on one order and £3.75/week on another                                      |
| R13 | Damage waiver ≠ configured % of hire charges on that invoice, charged on transport, present on an order flagged as exempt, or missing on an order where it applied last month                                                                                                            |                                                                                                   |
| R14 | Broken continuation chain: "last invoice" on a continuation invoice doesn't match the previous invoice we hold for that job number (a missing invoice, or something changed on the order)                                                                                                |                                                                                                   |
| R16 | Suspension credit missing on an order of a site that had a suspension in that period                                                                                                                                                                                                     |                                                                                                   |
| R17 | Transport: collection (or delivery) charged more than once on the same order and period (failed collection attempts)                                                                                                                                                                     | Two "Tower Collection" lines two days apart                                                       |
| R15 | **Item tracking month to month**, per job number: a fleet code billed last month is gone this month with no return invoice (returned? lost? swapped?); a new fleet code appears on an existing order (item swapped: check the rate and the start date); a fleet code moves between sites | Fleet code X on job 1001 billed in July, absent in August, no Return invoice: confirm on site     |

Tolerance for R5/R6/R12 is configurable (default £0.05). R15 is the heart of the "are we still paying for things that are not on site" question: the on-hire register is built from it, and every finding there is marked "confirm on site".

### 4.2a Due dates and payment tracking

Every invoice has a due date (the supplier prints it; default 30 days from the invoice date). The app tracks `paymentStatus` (`UNPAID`, `PAID`, `QUERIED`, `CREDITED`) and shows what is due in the next 7 / 14 days and what is overdue, per supplier and per site. The monthly statement and the outstanding spreadsheet are imported (CSV/XLSX) to run R11 and to update what the supplier still considers unpaid. This replaces the manual upload into the team's task board; a later phase can push items to Monday.com through an interface.

### 4.3 VAT and rounding

- VAT is calculated **per line, rounded to the penny**; totals are the sum of rounded lines.
- Reports always use the per-line figure, so they match the invoices exactly.
- Tests must prove that `sum(rounded line VAT)` can differ from `round(net total × 0.2)` and that the report uses the former. (This exact few-pence discrepancy breaks real monthly cost reports.)

### 4.4 Cost allocation

- Each order has a trade; a line can override it.
- Monthly report: site × trade, net and gross, plus the list of lines behind each cell.
- Yearly report: per site per month.

### 4.5 Notes from Florin for phase 5 (to confirm before building)

- **"Our ref" is the key.** Florin expects the "Our ref" printed on the invoices to be the key that identifies the hire order, as in the spreadsheet. To confirm: is it our own order number (the spreadsheet's "order number" column) or the supplier's job / contract number? If it is our order number, `HireOrder` gets an `orderRef` field, and line linking uses it before the supplier's job number.
- **Items and E-codes.** Under each order the invoice lists the items, and many of them carry an E-code, the same code the spreadsheet holds. An E-code can change from one monthly continuation invoice to the next, when the item is swapped or the product changes. To confirm: is the E-code the fleet code (the id of the physical item) or a separate product code printed next to it? Either way the app keeps the history of an item's codes (old code, new code, from which invoice), so that R15 shows a change of code as a swap to confirm, not as one item gone plus an unknown one billed.
- **Acceptance test with real documents.** The final test of phase 5 runs the invoices of the previous months through the app, and every supplier statement must match them (R11): every statement line found, every amount equal, nothing held that is not on a statement. The real invoices and statements stay on Florin's machine (a git-ignored folder) or in the private deployment (section 9). They are never committed and never used in CI.

## 5. Suggested data model

- `Supplier`: id, name, accountNo, rateUnit (`WEEK_5_WORKING_DAYS` default), chargeWeekends, chargeBankHolidays, minChargeDays, damageWaiverPct, paymentTerms (`END_OF_NEXT_MONTH` | `NET_N`), paymentTermsDays?
- `Site`: id, code, name, aliases[] (customer references as the supplier spells them), deliveryAddress
- `HireOrder`: id, supplierJobNo, supplierId, siteId, trade, startDate (first despatch), offHireDate?, collectionNo?, offHireEnteredBy?, damageWaiverApplies, status (`ON_HIRE`, `OFF_HIRED`, `COLLECTED`)
- `HireItem`: id, orderId, description, fleetCode, qty, weeklyRate, despatchNo, despatchDate, isAccessory
- `Invoice`: id, supplierId, number, date, dueDate?, type (`CONTINUATION`, `RETURN`, `SALE`), isCreditNote, lastInvoiceNo?, customerRef, net, vat, gross, filePath?, checkStatus (`NOT_CHECKED`, `CHECKED`, `QUERIED`), paymentStatus (`UNPAID`, `PAID`, `QUERIED`, `CREDITED`)
- `InvoiceLine`: id, invoiceId, orderId?, hireItemId?, fleetCode?, description, qty, periodFrom?, periodTo?, weeks, days, rate, chargeType (`HIRE`, `DAMAGE_WAIVER`, `TRANSPORT`, `SALE`, `OTHER`), net, vat, trade?
- `StatementLine`: id, supplierId, statementDate, invoiceDate, jobNo, invoiceNo, customerRef, amount, matchedInvoiceId?
- `ServiceEvent`: id, orderId, date, type, notes, confirmedBy
- `Finding`: id, invoiceLineId?, invoiceId, check (R1-R10), severity, billed, expected, difference, message, resolved

This may be refined; changes go in this file.

**Implemented so far (Phase 2, `prisma/schema.prisma`):** `Supplier`, `Site`, `HireOrder` and `HireItem`, with these refinements:

- Calendar dates (`startDate`, `offHireDate`, `despatchDate`) are `YYYY-MM-DD` strings, not timestamps: they are days and must not shift with time zones. Money is stored in whole pence (`weeklyRatePence`); the API takes and returns pounds.
- `HireOrder.status` moves only forward, `ON_HIRE -> OFF_HIRED -> COLLECTED`, through the off-hire and collection endpoints; it cannot be edited directly. Off-hire with a collection number goes straight to `COLLECTED`. The off-hire date cannot be before the start of hire and can only be set once.
- `(supplierId, supplierJobNo)` is unique: a job number identifies one hire order of one supplier.
- `offHireEnteredBy` is replaced for now by `offHireEnteredAt` (a timestamp); users and roles come in phase 8.
- `damageWaiverApplies` defaults to true when the supplier charges a damage waiver (`damageWaiverPct > 0`).
- `Site.aliases` comes with invoice extraction in phase 5, where customer references are normalised.

**Implemented in Phase 3:** `Invoice` and `InvoiceLine`.

- An invoice is recorded **exactly as printed**, totals included, even when they are wrong: finding mistakes is the job of the checks (R10 and others), not of data entry. Credit lines can be negative and their period can be printed with From after To.
- An invoice number is unique per supplier (duplicate protection, 409). The same number from another supplier is accepted.
- The due date is taken from the invoice when printed, otherwise calculated from the supplier's payment terms.
- `Invoice.jobNo` holds the job number printed in the header. Each line is linked when it is saved: a line with a fleet code to the item with that code (first within the header's job, otherwise the only item with that code), a line without one (damage waiver, transport) to the job's order. A line that cannot be linked keeps `linkProblem`: `UNKNOWN_FLEET_CODE`, `AMBIGUOUS_FLEET_CODE` or `UNKNOWN_JOB_NO`. These feed R8 and R15 in phase 4.

**Implemented in Phase 4a (`src/lib/reconciliation`):** the engine and checks R1, R2, R3, R5, R7, R10 and R13.

- Each check is a pure function of a context: the invoice, the orders its lines are linked to, the other invoices of the same supplier on those orders, the supplier's charging rules, the tolerance and the VAT rate. The service builds the context from the database, runs every check and replaces the invoice's findings.
- Checks run when an invoice is saved; the other invoices of the same orders are re-checked at the same time (a credit note can close an R1 finding). Entering an off-hire date re-checks the order's invoices. `POST /api/invoices/:id/check` runs them on demand.
- R1 and R2 report the chargeable working days outside the hire and the overcharge (billed minus the expected charge for the days on hire). R1 is resolved when credit notes for the same item credit at least the overcharge, within the tolerance.
- R5 steps aside when R1 or R2 report chargeable days outside the hire, so one mistake is reported once. An undercharge is reported as LOW.
- R3 flags only the later of two invoices (by date, then number) and values the overlap at the daily rate (weekly rate / 5).
- R10 accepts 0% VAT on `OTHER` lines (loss and damage charges are outside the scope of VAT). Totals are compared to the penny.
- R13 treats a hire line not linked to an order as carrying damage waiver (the supplier's default).
- Findings are recalculated on every run; resolving a finding by hand (query outcome) comes with the discrepancy report.

**Implemented in Phase 4b:** checks R4, R6, R8, R12, R14, R15, R16, R17, site suspensions and the monthly discrepancy report.

- The check context also holds the other invoices of the same job number, every item on the supplier's orders and the suspensions of the sites involved. Saving an invoice re-checks the invoices of the same orders and the same job; recording a suspension re-checks the site's invoices.
- R6 compares weekly rates (net x 5 / (working days x qty)) with the item's most recent earlier billing, not amounts, so months with different numbers of working days are comparable; periods shorter than a week are skipped (the minimum charge distorts them). When R6 reports a line, R5 steps aside.
- R8 uses the link problem recorded when the line was saved, plus a fleet code linked to an order at another site than the invoice's job. An unknown fleet code puts the whole charge at stake.
- R12 compares item descriptions ignoring case and spacing. LOW: different rates can be legitimate.
- R14 compares the printed "last invoice" with the latest earlier non-credit invoice of the same job number, of any type.
- R15 compares a continuation invoice with the previous continuation invoice of the job. A missing fleet code is fine when its order is off-hired or a later return invoice bills it. A new fleet code is LOW. Every message ends with "Confirm on site".
- R16: a `Suspension` (site, period, free days) expects, under each hire line of an overlapping period, a negative hire sub-line for the same item of free days x weekly rate / 5 x qty.
- R17 recognises "collect" and "deliver" in transport descriptions and flags only the later of two charges for the same order.
- R4 is not an invoice check: it runs for the monthly report, on all orders on hire for at least one working day of the month, against the hire periods billed for them.
- The report sums the positive differences of open findings, in whole pence.

**Implemented in Phase 4c:** the on-hire register, due dates and payments, and the demo data.

- On-hire register per site (`GET /api/sites/:id/on-hire?asOf=`): every item of an order on hire, or off-hired and waiting for collection, with calendar and working days on hire, cost to date at the agreed rate, billed to date (credits included) and not yet billed. `asOf` defaults to today; it is a parameter so the register can be tested for any date.
- Payments (`GET /api/payments/due?asOf=`): unpaid invoices grouped as overdue, due in 0 to 7 days, 8 to 14 days and later; queried invoices on hold, apart; credit notes and paid or credited invoices left out; totals per site, the site being that of the invoice's first linked order.
- `PATCH /api/invoices/:id` changes only `paymentStatus` and `checkStatus`: the invoice itself stays as printed.
- R1 and R2 on the same line each report only their part of the overcharge (R1 cuts the period at the off-hire date only, R2 at the start only), so the report never counts the same pounds twice.
- The seed creates the demo data through the services, so every check runs on it; the test database is seeded too, and an API test proves every implemented check has an example.

## 6. Tech stack

- **TypeScript** everywhere.
- **Next.js** (App Router) for UI and REST API route handlers.
- **Prisma** with **SQLite** locally; **PostgreSQL** in Docker for CI (phase 4+, optional).
- **Zod** for request validation; **date-fns** for dates.
- **Unit tests:** Vitest. **API tests:** Playwright `request`. **E2E:** Playwright with Page Object Model, fixtures, tags `@smoke` / `@regression`, accessibility checks with `@axe-core/playwright`.
- **CI:** GitHub Actions: lint, typecheck, unit, API, E2E; Playwright HTML report uploaded and published to GitHub Pages.
- **Synthetic data:** a seed script with a fictional hire company ("Apex Plant Hire"), fictional sites, items and fleet codes, and a generator for realistic sample invoice PDFs. The seed deliberately includes overcharges so every check R1-R17 has something to find in the demo.

## 7. Test strategy

| Layer | Tool               | What it covers                                                                                                                                        | Rough share              |
| ----- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Unit  | Vitest             | charge calculator, chargeable days, overlaps and gaps, each reconciliation check, VAT rounding, allocation sums                                       | most tests               |
| API   | Playwright request | every endpoint: happy path, validation (400), not found (404), conflicts (409, e.g. duplicate invoice number), findings returned for a seeded invoice | many                     |
| E2E   | Playwright UI      | add order → add invoice → see findings; off-hire an item → next invoice flagged; on-hire register; monthly allocation report                          | few, critical flows only |

Principles:

- The charge calculator and reconciliation checks are built **test-first** (TDD). The commit history should show it.
- Each check R1-R10 has its own test file with positive and negative cases and edge cases (month ends, leap year, off-hire on a weekend, period crossing a month).
- Test data through builders/factories and API setup, not through the UI.
- No shared state between tests; parallel-safe.
- Test names read like requirements (`R1: line billed past the off-hire date is flagged with the overcharged days`).
- Bugs found while building are logged as GitHub issues (steps, expected, actual) and fixed with a regression test that references the issue.

## 8. Phases

Each phase ends with: a demo, CI green, a merged PR, interview notes for Florin.

0. **Setup.** Next.js + TS, ESLint/Prettier, Vitest, Playwright, GitHub Actions running a first unit, API and E2E test. `.env.example`, README skeleton.
1. **Charge calculator (TDD).** Working days in a period, weeks + extra days, line charge rounding, damage waiver, the worked examples in 4.1, month boundaries, leap year, bank-holiday flag.
2. **Sites, orders, items API + UI.** Off-hire and collection. API test suite. First Page Objects.
3. **Invoices and lines.** Manual entry, linking by order number / fleet code, duplicate invoice protection. API + E2E.
4. **Reconciliation engine + discrepancy report.** Checks R1-R8, R10, R12-R17, findings UI, on-hire register, due-date and payment view. This is the core value; the regression suite and the published test report land here.
5. **Upload + AI extraction.** PDF upload, `MockExtractor` for tests, `AiExtractor` behind a flag, review screen, contract tests with recorded responses (no live calls in CI). Statement import (CSV/XLSX) and R11.
6. **Reports.** Monthly allocation site × trade, yearly totals, CSV/Excel export.
7. **Service events + extras.** R9, query email draft, long-hire and cost alerts.
8. **Optional.** Java RestAssured module, Postgres in CI, roles, Monday.com sync.
9. **Polish.** README with architecture diagram, test strategy, screenshots/GIF, how to run, CI badges. Florin adds the project to his CV and LinkedIn.

## 9. Using it for real

The public repo only ever holds fictional data. To use it at work, it can be deployed privately with the real suppliers' charging rules and real orders entered there, never committed.

## 10. What "great" looks like for a reviewer

Someone opening the repo should see in two minutes: what the app does and why, how to run it, a green CI badge, a link to the latest test report, a clear test folder structure, and a commit history with tests written alongside (or before) the code.
