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
