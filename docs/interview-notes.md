# Interview notes

What I can explain about this project, phase by phase.

## Phase 0: setup

- **Test pyramid from day one.** One test at each level: unit (Vitest), API (Playwright `request`) and E2E (Playwright UI). The folders `tests/unit`, `tests/api` and `tests/e2e` make the pyramid visible in the repo structure.
- **TDD on money.** I wrote the tests for `round2` before the function existed. The obvious `Math.round(x * 100) / 100` failed 3 of 6 cases: `1.005` rounds to `1.00` because of floating point, negative credits don't mirror charges, and tiny credits become `-0`. The git history shows the failing tests committed before the implementation.
- **Test names read like requirements.** A failing test in CI says which rule broke without opening the code.
- **API tests check the negative path too.** The health endpoint test checks the 200 response and its exact JSON body, and that `POST` is refused with 405.
- **Page Object Model with fixtures.** `HomePage` holds the locators, the test holds the assertions, and a fixture injects the page object. A UI change is fixed in one place.
- **Role-based locators.** `getByRole` finds elements the way a user or a screen reader does, so tests break only when what the user sees changes. No CSS or XPath chains.
- **No fixed sleeps.** Web-first assertions such as `toBeVisible` retry until the condition is true, so tests are neither slow nor flaky.
- **A test must be able to fail.** I broke the page title on purpose and confirmed the E2E test went red with a screenshot.
- **Playwright config built for CI.** Separate `api` and `e2e` projects, `webServer` waiting on `/api/health`, the production build in CI, `forbidOnly`, one retry with a trace recorded on retry, screenshots on failure.
- **CI with GitHub Actions.** Two parallel jobs: fast static checks with unit tests, and Playwright against the production build. Least-privilege permissions, cancelled superseded runs, and HTML reports uploaded as an artifact even when tests fail.
- **Static checks first.** ESLint for code quality, Prettier for formatting, TypeScript in strict mode. They are the cheapest checks, so they run first.
- **Reproducible environment.** Node 24 LTS pinned in `.nvmrc` and used by CI, exact dependency versions in `package-lock.json`, `npm ci` in CI.
- **Secrets hygiene.** `.env*` is git-ignored except `.env.example`. GitHub CLI login used device flow, so no password went through the terminal.
- **Supply chain awareness.** npm 11 blocks install scripts by default. I reviewed the two packages that asked for one and denied both, recorded in `package.json`.

## Phase 1: charge calculator

- **Strict TDD, visible in git.** Each unit has a `test:` commit with failing tests followed by a `feat:` commit with the implementation: working days, the hire charge of a period, the damage waiver.
- **Expected values computed independently.** I checked the expected numbers with a separate Python script using exact decimal arithmetic, so the tests don't just repeat what the code computes.
- **Boundary value analysis on dates.** Weekends at both ends, a single day, month ends, February in a normal and a leap year, a period across the year end, off-hire on a Saturday.
- **Both settings of a flag are tested.** Bank holidays charged and not charged, including the brief's own August example where 31 August is a bank holiday.
- **Time zones designed out.** Dates are `YYYY-MM-DD` strings and all arithmetic is in UTC, so the count is the same on my laptop and on the CI server. Impossible dates such as 30 February are rejected instead of silently rolling over.
- **Expected charge, not billed charge.** The calculator cuts the period to the days the item was really on hire. The difference with what was billed is what the reconciliation checks will report.
- **An ambiguous rule made explicit.** The one-week minimum for a short hire across a month end: I chose to add the missing days on the return invoice, documented it in the brief with an example and marked it to confirm against a real invoice.
- **Rounding is a business rule.** Round once per line, then multiply by quantity; add the damage waiver lines first, then round once. Each choice has a test that would fail with the other choice.
- **Readable, data-driven tests.** A small builder gives a valid input and each test overrides only what it is about; `it.each` tables cover similar cases without copy-paste.

## Phase 2: sites, hire orders and items

- **One set of rules for the UI and the API.** Route handlers and Server Actions both call the same service layer, and the services validate with the same Zod schemas. A rule cannot be enforced in one channel and forgotten in the other.
- **Validation at the boundary.** Zod schemas trim and normalise input, reject unknown fields (a typo is a 400, not silently ignored), and give every error a field path such as `items.0.weeklyRate`.
- **A consistent error contract.** Every error is `{ error: { code, message, issues? } }`: 400 for validation, 404 for a missing resource, 409 for duplicates and for state changes that are not allowed. Clients and tests can rely on the code, not on message text.
- **State machine as a pure function.** `ON_HIRE -> OFF_HIRED -> COLLECTED` lives in `planOffHire` and `planCollection`, unit-tested without a database; the API maps rule violations to 409.
- **Data modelling choices.** Dates as `YYYY-MM-DD` strings so they never shift with time zones; money in whole pence so it is never a float; the response fields listed explicitly so a new column is never exposed by accident.
- **API test design.** 43 Playwright API tests: happy paths, 400, 404 and 409 for every endpoint, including invalid JSON sent as raw bytes. Each test creates its own data through the API with random codes, so tests are independent, parallel-safe and runnable alone.
- **Test environment isolation.** The tests start their own server on port 3100 with their own database, recreated empty for every run, and their own build folder, so they never touch development data and can run next to `npm run dev`.
- **Mutation check.** I changed one status code in the error mapping and confirmed that exactly the two tests about it failed.
- **E2E through Page Objects, setup through the API.** UI tests create their data with an API client and only drive the screen they are about. One E2E test also checks the result through the API, proving the UI change was saved.
- **Accessibility as a test.** Labelled inputs, errors linked with `aria-describedby`, and an axe scan (WCAG 2.1 A and AA) on each page that fails the test on any violation. Tests assert the accessible description of a field, so the error is checked the way a screen reader user gets it.
- **Stability check.** I ran the whole Playwright suite three times in a row (165 runs, no failures) before opening the PR.

## Phase 3: invoices and invoice lines

- **Record what was billed, check it later.** Invoices are stored exactly as printed, wrong totals included. Rejecting them at entry would hide the very overcharges the app exists to find; the reconciliation checks report them instead.
- **Duplicate protection in two layers.** The service checks for the supplier's invoice number and returns a clear 409; a unique database constraint backs it up. A mutation test showed the difference: with the service check removed, the database still refused the duplicate, but with a generic error, and the test caught it.
- **Linking as a pure function.** `linkInvoiceLine` decides which order and item a line belongs to (fleet code first within the invoice's job, then a unique match; job number for lines without a fleet code) and returns the reason when it cannot. Eight unit tests cover every branch without a database.
- **Domain rules tested at the edges.** Due dates at month ends, February in a leap year and across the year end, for both payment-term types; credit lines with negative amounts and backwards periods.
- **Dynamic forms that stay testable.** The invoice form adds and removes lines; each line is a labelled fieldset ("Line 2"), so tests target `getByRole("group", { name: "Line 2" }).getByLabel("Net (£)")` and errors point at the exact field of the exact line.
- **Strict locators catch ambiguity.** "Invoice number" also matched "Last invoice number"; Playwright's strict mode failed the test instead of filling the wrong field, and `exact: true` fixed it.
- **Choosing the locator honestly.** Where an element has no role and name to find it by (a value in a definition list), I used a `data-testid` rather than an XPath chain, and documented why in the Page Object.
- **Looking at the screen.** A headless screenshot showed "4 wks 1 days", which no test asserted; fixed to match the invoices' "4 wks 1 day".

## Phase 4a: reconciliation engine and the first checks

- **An engine of pure functions.** Each check takes a plain context (the invoice, its orders, related invoices, the supplier's rules) and returns findings. No database in the checks, so 52 unit tests run in milliseconds and every edge case is cheap to test.
- **One file and one test file per check**, as the brief asks, plus shared test data builders: each test overrides only what it is about, so it reads like the requirement.
- **Findings that explain themselves.** Each finding has a check, a severity, the line, a message a buyer can send to the supplier, and billed / expected / difference in pounds.
- **Business behaviour, not just arithmetic.** R1 closes itself when the supplier's credit note arrives; R5 steps aside when R1 or R2 already report the line, so one mistake is reported once; R3 flags only the second billing; R10 proves the brief's rounding rule with the exact three-line example where the VAT total differs from 20% of the net total.
- **Checks re-run when their inputs change.** Saving an invoice, entering an off-hire date or receiving a credit note re-checks the affected invoices; API tests prove each trigger.
- **I found a bug in my own check with a test.** R5 skipped every first-month line billed from the 1st when the order started on the Monday after. I wrote the failing test first, then fixed it.
- **I found a bug the suite could not see.** `npm run dev` reloaded pages in an endless loop because of an explicit `distDir`, but the test server used a different folder, so every test was green. I logged it as GitHub issue #5 with steps, expected and actual, fixed it, and added a regression test that fails on the old config. Lesson: test environments that differ from what users run can hide bugs; a manual look at the real app still matters.
- **The critical E2E flow from the brief.** Off-hire an item on the site page, enter the next invoice by hand, and see the R1 finding with the overcharge.

## Phase 4b: cross-invoice checks and the monthly report

- **Checks that need history.** R6, R14 and R15 compare an invoice with the job's earlier invoices; R12 with the supplier's other orders; R16 with the site's suspensions. The context builder loads exactly that, and saving one invoice re-checks the invoices it can affect (same orders, same job). An API test shows R14 repaired automatically when the missing invoice is entered later.
- **One mistake, one finding.** R5 steps aside when R6 reports a rate change, as it already does for R1 and R2. Each rule has a test proving it.
- **Modelling choices written down.** R6 compares weekly rates, not amounts, so 21- and 23-day months compare; R15 messages end with "Confirm on site", because the truth is on site, not in the data. These go in the brief next to the rules.
- **Pure logic tested at the lowest level.** The report totals are a pure function with unit tests (overcharges only, open only, added in pence); the API test only checks the wiring.
- **Parallel-safe report tests.** A report covers all data, so each test uses a random far-future month and looks for its own rows with `toContainEqual`. A test that expected exactly one row failed because the report correctly listed other tests' orders: the test was wrong, not the app.
- **Playwright has no `test.each`.** Parameterised tests are a `for` loop declaring one test per value.
- **Debugging a flaky environment properly.** A full E2E run failed with pages reloading in a loop. I reproduced it outside the tests, ruled out hypotheses one by one with measurements (file writes, first compiles, two config flags), found it was a known Next.js 16.4 Turbopack regression triggered when an API route compiles before a page opens, and turned off the dev cache. It is logged as issue #7 with steps, expected, actual and the upstream link, and fixed with a regression test that fails without the setting.
- **Test what you ship.** Playwright now always runs against a production build (`next build` + `next start`, about 4 seconds), locally as in CI, so no test depends on dev hot reload.
- **Locators again.** `getByLabel("Month")` also matched "Choose a month" and "Findings on the month's"; `exact: true` fixed it. Strict mode made the ambiguity a clear failure instead of a wrong click.

## Phase 4c: on-hire register, payments and demo data

- **Time as a parameter.** The register and the due list take `asOf` (default today). Pure functions with an explicit date are deterministic, so unit tests use fixed dates; the one E2E test that needs "today" compares the page with the API's answer for the same day instead of hard-coding numbers.
- **Boundaries tested on purpose.** Due today, in exactly 7 days, in 8, in exactly 14 and in 15 days each have a test; so do an item delivered after the date asked for and an item off-hired but not yet collected.
- **The invoice stays as printed.** The status update accepts only `paymentStatus` and `checkStatus`; an API test proves an attempt to change the amount is a 400 and the amount is unchanged.
- **Demo data that proves the checks.** The seed goes through the same services as the app, contains one deliberate supplier mistake per check, and an API test fails if any implemented check stops finding its example. A README table maps each mistake to its check.
- **Designing the demo found a real bug.** A line billed both before delivery and after off-hire was counted twice in the report, once by R2 and once by R1. A failing test first, then each check reports only its own part, and the parts add up to the total.
- **Safety in scripts.** The database reset scripts refuse to delete any file other than the dev or test database they are meant for.

## Phase 5a: our order number, site recognition and fleet code changes

- **Domain knowledge turned into rules.** Florin told me our order number is the real key and that E-codes change when items are swapped. I wrote both into the brief first, asked what each code actually is, and only then changed the data model.
- **Refactor first, then behaviour.** Changing the linking function's signature was a separate commit with no behaviour change and all tests green; the new behaviour came after, test-first.
- **Identity over raw values.** R15 now compares items, not codes: a recorded code change is the same item, and an unrecorded one is reported once as a possible swap instead of two unrelated findings.
- **Recognition that refuses to guess.** Site recognition tries an explicit order of rules (alias, name, code, name words, postcode) and returns candidates instead of a site when a rule fits two. A wrong site is worse than no site.
- **Order of events does not matter.** An invoice can arrive before its order; entering the order, an item or a new code re-links the waiting lines and re-runs the checks. An API test proves it.
- **Real data stays local.** The app is designed around the real documents, which live in a git-ignored folder and the local database; everything committed is fictional, because git history keeps a file even after it is replaced.
- **Test helpers deserve care too.** I replaced a test that faked an order with a type cast by a proper `createInvoiceForSupplier` helper.

## Phase 5b: reading invoice PDFs

- **The simplest tool that does the job.** The brief planned AI extraction. Looking at the real documents first showed two suppliers, both sending PDFs with text. A template per layout is exact, free, fast and testable without mocks, so I proposed it, Florin agreed, and AI stays a fallback for a future third supplier.
- **Test data that behaves like the real thing.** The fixtures are fictional documents written as text in each layout. A helper turns them into text fragments for fast unit tests and into real PDFs (pdf-lib) for round-trip tests through the same PDF reader the app uses. Neither contains real data.
- **Validated on production data without committing it.** A local-only test in the git-ignored folder ran every real invoice through the reader: 269 invoices. It found three real problems, and each got a fictional failing test before the fix: VAT rounded once on the total, suspension credits printed under an item, and a site address broken by text at other heights.
- **Questioning the spec with evidence.** The brief said VAT is rounded per line. The real invoices round once on the total, which is also allowed. I changed R10 to accept both and flag anything else, updated the existing test that encoded the old rule, and wrote the reason in the brief.
- **Thresholds from measurements.** Cells are split by the gap between text pieces. I measured the gaps on the real PDFs (columns as close as 4 points) before choosing 3 points, and made the test PDFs use realistic type sizes instead of bending the rule to the fixtures.
- **A human checks before anything is saved.** Reading fills the form and lists warnings; only "Save invoice" records it. Fields that cannot be read are left empty, never guessed.
- **File uploads done safely.** Size limit, PDF signature check, server-generated ids as file names (no path from the client), a path-traversal guard when reading back, `nosniff` on the download, and the files folder outside git. The test reset only empties a folder named `test-*`.
- **Mutation checks.** Breaking the credit-note sign fails 2 unit tests; breaking the column threshold fails 14.
- **Strict locators catch accessibility bugs.** The upload form and its file input had the same accessible name; Playwright's strict mode failed on the ambiguity, and the fix made the page clearer for screen readers too.
