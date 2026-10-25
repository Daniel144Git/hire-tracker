# Hire Tracker

Tracks equipment hired for construction sites and checks every hire invoice against what was actually on site: items, periods, rates, returns, credits and the supplier's statements.

Built as a test-automation portfolio project: the application is real, the test suite is the showcase (Vitest unit tests, Playwright API and E2E tests with Page Object Model, GitHub Actions CI with published reports).

- `docs/BRIEF.md` — what the app does, the business rules, the test strategy and the phases.

## Run locally

Requires Node.js 24 (see `.nvmrc`; with nvm, run `nvm use`).

```bash
npm install
npx playwright install chromium
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Then open http://localhost:3000/sites, or http://localhost:3000/invoices to enter an invoice. The seed adds fictional demo data: the supplier Apex Plant Hire, three sites and two hire orders on RVS - Riverside Tower.

The API and E2E tests build the app and start their own production server on port 3100, with a separate database (`prisma/test.db`) recreated empty for every run, so they never touch your demo data and never depend on dev hot reload.

| Command                | What it does                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| `npm run dev`          | Starts the development server                                    |
| `npm run build`        | Builds the production app                                        |
| `npm run lint`         | Runs ESLint                                                      |
| `npm run typecheck`    | Generates Next.js route types, then runs the TypeScript compiler |
| `npm run format`       | Formats all files with Prettier                                  |
| `npm run format:check` | Fails if any file is not formatted                               |
| `npm test`             | Runs the unit tests (Vitest)                                     |
| `npm run test:watch`   | Runs the unit tests in watch mode                                |
| `npm run test:api`     | Runs the API tests (Playwright, no browser)                      |
| `npm run test:e2e`     | Runs the end-to-end UI tests (Playwright, Chromium)              |
| `npm run test:report`  | Opens the last Playwright HTML report                            |

## API

All endpoints take and return JSON. Money is in pounds, dates are `YYYY-MM-DD`. Every error has the same shape: `{ "error": { "code", "message", "issues"? } }`.

| Method and path                                | What it does                                                                                         | Errors                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------- |
| `GET /api/health`                              | Health check                                                                                         |                               |
| `GET, POST /api/suppliers`                     | List or create suppliers and their charging profile                                                  | 400, 409 duplicate name       |
| `GET, POST /api/sites`                         | List or create sites                                                                                 | 400, 409 duplicate code       |
| `GET, PATCH /api/sites/:id`                    | Get or edit a site                                                                                   | 400, 404, 409                 |
| `GET /api/orders?siteId=&status=`              | List hire orders, filtered by site and status                                                        | 400                           |
| `POST /api/orders`                             | Create a hire order with its items                                                                   | 400, 409 duplicate job number |
| `GET, PATCH /api/orders/:id`                   | Get an order, or change its trade or damage waiver                                                   | 400, 404                      |
| `POST /api/orders/:id/items`                   | Add an item or accessory to an order                                                                 | 400, 404                      |
| `POST /api/orders/:id/off-hire`                | Off-hire: date and optional collection number                                                        | 400, 404, 409 not on hire     |
| `POST /api/orders/:id/collection`              | Record the collection of an off-hired order                                                          | 400, 404, 409 not off-hired   |
| `GET /api/invoices?supplierId=&jobNo=`         | List invoices with due dates, lines not linked and open findings                                     | 400                           |
| `POST /api/invoices`                           | Record an invoice as printed; due date from the supplier's terms; lines linked to orders; checks run | 400, 409 duplicate number     |
| `GET /api/invoices/:id`                        | Get an invoice with its lines, what each line is linked to, and its findings                         | 404                           |
| `POST /api/invoices/:id/check`                 | Run the reconciliation checks again and return the findings                                          | 404                           |
| `GET, POST /api/sites/:id/suspensions`         | List or record site suspensions (free days credited); re-checks the site's invoices                  | 400, 404                      |
| `GET /api/reports/discrepancies?month=YYYY-MM` | The month's findings, totals and orders on hire with no invoice                                      | 400                           |

## Reconciliation checks

Every invoice is checked as soon as it is saved, and again when something it depends on changes: an off-hire date entered on one of its orders, a credit note or a later invoice of the same orders or job, or a suspension recorded on the site. Each check is a pure function in `src/lib/reconciliation/checks`, with its own unit test file.

| Check | What it finds                                                                                                                                | Severity                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| R1    | Hire billed after the off-hire date; closed automatically when credit notes cover the overcharge                                             | High                         |
| R2    | Hire billed before the start of hire                                                                                                         | High                         |
| R3    | The same item billed twice for the same working days                                                                                         | High                         |
| R5    | A hire line that differs from the agreed rate x chargeable units by more than £0.05                                                          | Medium (Low if undercharged) |
| R7    | A continuation invoice after the order's return invoice                                                                                      | Medium                       |
| R10   | Line VAT that is not 20% rounded to the penny, or header totals that are not the sum of the lines                                            | Medium                       |
| R13   | A damage waiver that is not the supplier's % of the hire lines, is charged on transport, is charged when no order carries one, or is missing | Medium (Low if missing)      |
| R4    | An order on hire for a month with no invoice covering it (monthly report)                                                                    | Report                       |
| R6    | A weekly rate that changed since the item's previous billing                                                                                 | Medium                       |
| R8    | A fleet code on no hire order, on more than one, or on an order at another site; a job number on no order                                    | High / Medium                |
| R12   | The same item type hired at different weekly rates on different orders                                                                       | Low                          |
| R14   | A "last invoice" that is not the previous invoice held for the job                                                                           | Medium                       |
| R15   | A fleet code billed last month that is gone with no return invoice, or new on the job: confirm on site                                       | Medium / Low                 |
| R16   | A missing or wrong suspension credit on a site with a recorded suspension                                                                    | High / Medium                |
| R17   | A collection or delivery charged more than once for the same order                                                                           | Medium                       |

The monthly discrepancy report (`/reports/discrepancies?month=YYYY-MM`) lists every finding on the month's invoices, the amount overcharged on open findings, and the orders on hire with no invoice (R4). R9 (service events) and R11 (supplier statements) come in later phases.

## Continuous integration

GitHub Actions runs on every pull request and on every push to `main` (`.github/workflows/ci.yml`):

- **Lint, typecheck and unit tests**: ESLint, Prettier check, TypeScript, Vitest.
- **API and E2E tests**: Playwright builds the production app, starts it, then runs the API and E2E tests against it. The HTML reports are uploaded as the `playwright-report` artifact of each run.

## Configuration

Environment variables are documented in `.env.example`. Copy it to `.env` for local settings. `.env` is never committed.

Status: Phase 4 in progress: the reconciliation checks and the monthly discrepancy report are in; the on-hire register and the due-date and payment view are next. Earlier phases added the charge calculator (`src/lib/charging`, built test-first) and sites, hire orders and items. All data in this repository is fictional.
