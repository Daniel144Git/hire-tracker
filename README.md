# Hire Tracker

Tracks equipment hired for construction sites and checks every hire invoice against what was actually on site: items, periods, rates, returns, credits and the supplier's statements.

Built as a test-automation portfolio project: the application is real, the test suite is the showcase (Vitest unit tests, Playwright API and E2E tests with Page Object Model, GitHub Actions CI with published reports).

- `docs/BRIEF.md` — what the app does, the business rules, the test strategy and the phases.

## Run locally

Requires Node.js 24 (see `.nvmrc`). With nvm, run `nvm use` in the project folder first: the SQLite driver is built for Node 24.

```bash
nvm use
npm install
npx playwright install chromium
cp .env.example .env
npm run db:reset
npm run dev
```

Then open http://localhost:3000. `npm run db:reset` creates the database with fictional demo data (see below); run it again at any time to start over.

The API and E2E tests build the app and start their own production server on port 3100, with a separate database (`prisma/test.db`) recreated for every run, so they never touch your data and never depend on dev hot reload.

| Command                   | What it does                                                        |
| ------------------------- | ------------------------------------------------------------------- |
| `npm run dev`             | Starts the development server                                       |
| `npm run build`           | Builds the production app                                           |
| `npm run lint`            | Runs ESLint                                                         |
| `npm run typecheck`       | Generates Next.js route types, then runs the TypeScript compiler    |
| `npm run format`          | Formats all files with Prettier                                     |
| `npm run format:check`    | Fails if any file is not formatted                                  |
| `npm test`                | Runs the unit tests (Vitest)                                        |
| `npm run test:watch`      | Runs the unit tests in watch mode                                   |
| `npm run test:api`        | Runs the API tests (Playwright, no browser)                         |
| `npm run test:e2e`        | Runs the end-to-end UI tests (Playwright, Chromium)                 |
| `npm run test:report`     | Opens the last Playwright HTML report                               |
| `npm run db:reset`        | Recreates the development database with the demo data               |
| `npm run db:migrate`      | Applies database migrations (and creates one after a schema change) |
| `npm run db:seed`         | Adds the demo data to an empty database                             |
| `npm run db:test:prepare` | Recreates the test database (the tests run it themselves)           |

## API

Endpoints take and return JSON, except that a PDF is sent as a multipart form and an invoice's PDF comes back as a PDF. Money is in pounds, dates are `YYYY-MM-DD`. Every error has the same shape: `{ "error": { "code", "message", "issues"? } }`.

| Method and path                                                                        | What it does                                                                                                             | Errors                        |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `GET /api/health`                                                                      | Health check                                                                                                             |                               |
| `GET, POST /api/suppliers`                                                             | List or create suppliers and their charging profile                                                                      | 400, 409 duplicate name       |
| `GET, POST /api/sites`                                                                 | List or create sites                                                                                                     | 400, 409 duplicate code       |
| `GET, PATCH /api/sites/:id`                                                            | Get or edit a site                                                                                                       | 400, 404, 409                 |
| `GET /api/orders?siteId=&status=`                                                      | List hire orders, filtered by site and status                                                                            | 400                           |
| `POST /api/orders`                                                                     | Create a hire order with its items                                                                                       | 400, 409 duplicate job number |
| `GET, PATCH /api/orders/:id`                                                           | Get an order, or change its trade or damage waiver                                                                       | 400, 404                      |
| `POST /api/orders/:id/items`                                                           | Add an item or accessory to an order                                                                                     | 400, 404                      |
| `POST /api/orders/:id/off-hire`                                                        | Off-hire: date and optional collection number                                                                            | 400, 404, 409 not on hire     |
| `POST /api/orders/:id/collection`                                                      | Record the collection of an off-hired order                                                                              | 400, 404, 409 not off-hired   |
| `GET /api/invoices?supplierId=&siteId=&month=&paymentStatus=&openFindings=true&jobNo=` | List invoices with due dates, lines not linked and open findings, filtered                                               | 400                           |
| `POST /api/invoices`                                                                   | Record an invoice as printed; due date from the supplier's terms; lines linked to orders; checks run                     | 400, 409 duplicate number     |
| `POST /api/invoices/extract`                                                           | Read an invoice PDF (multipart field `file`) into a draft to check; the PDF is kept; nothing is saved as an invoice      | 400 not a PDF                 |
| `POST /api/invoices/import`                                                            | One PDF of a batch (multipart `file`): saved when read cleanly, reported when already recorded, otherwise kept to check  | 400 not a PDF                 |
| `GET /api/invoices/drafts`, `GET, DELETE /api/invoices/drafts/:id`                     | Invoices from an upload waiting to be checked: what was read, the warnings, the fields still to fill in; discard one     | 404                           |
| `GET /api/invoices/:id/file`                                                           | The invoice's PDF, when it was uploaded (`hasFile` on the invoice)                                                       | 404                           |
| `GET /api/invoices/:id`                                                                | Get an invoice with its lines, what each line is linked to, and its findings                                             | 404                           |
| `POST /api/invoices/:id/check`                                                         | Run the reconciliation checks again and return the findings                                                              | 404                           |
| `GET, POST /api/sites/:id/suspensions`                                                 | List or record site suspensions (free days credited); re-checks the site's invoices                                      | 400, 404                      |
| `GET /api/reports/discrepancies?month=YYYY-MM`                                         | The month's findings, totals and orders on hire with no invoice                                                          | 400                           |
| `GET /api/sites/:id/on-hire?asOf=YYYY-MM-DD`                                           | The site's on-hire register: items on site, days on hire, cost and billed to date                                        | 400, 404                      |
| `PATCH /api/invoices/:id`                                                              | Change the payment status (paid, queried, credited) or the check status; nothing else                                    | 400, 404                      |
| `GET /api/payments/due?asOf=YYYY-MM-DD`                                                | Unpaid invoices: overdue, due in 7 and 14 days, later; queried ones apart; totals per site                               | 400                           |
| `GET, POST /api/sites/:id/service-events`                                              | Services, inspections, repairs, damage and losses recorded on site; recording one re-checks the site's invoices (R9)     | 400, 404                      |
| `GET /api/invoices/:id/query-email`                                                    | A query email to the supplier drafted from the invoice's open findings, or `null`; nothing is sent                       | 404                           |
| `GET /api/reports/discrepancies/query-emails?month=`                                   | One query email per supplier for the month's open findings                                                               | 400                           |
| `GET /api/alerts?asOf=&longHireDays=&costLimit=&collectionDays=`                       | Long hires, costly hires and off-hired items not collected, on every site                                                | 400                           |
| `GET /api/reports/costs?month=YYYY-MM`                                                 | The month's hire cost by site and trade, with the lines behind each site                                                 | 400                           |
| `GET /api/reports/costs/export?month=&format=csv\|xlsx\|zip`                           | The month as CSV (every line), Excel (summary and lines) or a ZIP with a folder per site: its invoice PDFs and a summary | 400                           |
| `GET /api/reports/yearly?year=YYYY`                                                    | Each site's cost by month, with month and year totals                                                                    | 400                           |
| `GET /api/reports/yearly/export?year=&format=csv\|xlsx`                                | The year as CSV or Excel                                                                                                 | 400                           |
| `GET, POST /api/statements`                                                            | List statements with how many lines match, or add one as JSON (the lines must add up to `total` when given)              | 400, 409 same date            |
| `POST /api/statements/upload`                                                          | Import a statement PDF (multipart field `file`): supplier by account number; refused if it does not add up               | 400                           |
| `GET /api/statements/:id`                                                              | The statement's lines and the R11 comparison with our invoices, worked out now                                           | 404                           |
| `GET /api/statements/:id/file`                                                         | The statement's PDF                                                                                                      | 404                           |
| `POST /api/statements/:id/mark-paid`                                                   | Mark paid our unpaid invoices dated before the statement that it no longer lists                                         | 404                           |
| `PUT /api/sites/:id/aliases`                                                           | Replace how suppliers spell the site in the customer reference                                                           | 400, 404, 409 duplicate alias |
| `GET /api/sites/recognize?customerRef=&deliveryAddress=`                               | Which site a customer reference and address point to (alias, name, code, postcode)                                       | 400                           |
| `POST /api/orders/:id/items/:itemId/fleet-code`                                        | Record a new fleet code (E-code) for a swapped item; links and re-checks the invoices                                    | 400, 404                      |

## Reconciliation checks

Every invoice is checked as soon as it is saved, and again when something it depends on changes: an off-hire date entered on one of its orders, a credit note or a later invoice of the same orders or job, or a suspension recorded on the site. Each check is a pure function in `src/lib/reconciliation/checks`, with its own unit test file.

| Check | What it finds                                                                                                                                                                                                                                                             | Severity                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| R1    | Hire billed after the off-hire date; closed automatically when credit notes cover the overcharge                                                                                                                                                                          | High                         |
| R2    | Hire billed before the start of hire                                                                                                                                                                                                                                      | High                         |
| R3    | The same item billed twice for the same working days                                                                                                                                                                                                                      | High                         |
| R5    | A hire line that differs from the agreed rate x chargeable units by more than £0.05                                                                                                                                                                                       | Medium (Low if undercharged) |
| R7    | A continuation invoice after the order's return invoice                                                                                                                                                                                                                   | Medium                       |
| R9    | A damage, loss, repair or service charge with no event recorded on the site from 60 days before the invoice to 7 days after (same item when both give a fleet code); low when the site is not known                                                                       | Medium                       |
| R10   | Line VAT that is not 20% rounded to the penny, a VAT total that is neither the sum of the lines' VAT nor 20% of the net total (both ways of rounding are allowed), or totals that do not add up                                                                           | Medium                       |
| R11   | Supplier statement: an invoice on it that is not in Hire Tracker or for another amount (high); an unpaid invoice of ours dated before it that it does not list, or, on the latest statement, an invoice we paid that it still lists (medium). Shown on the statement page | High, Medium                 |
| R13   | A damage waiver that is not the supplier's % of the hire lines, is charged on transport, is charged when no order carries one, or is missing                                                                                                                              | Medium (Low if missing)      |
| R4    | An order on hire for a month with no invoice covering it (monthly report)                                                                                                                                                                                                 | Report                       |
| R6    | A weekly rate that changed since the item's previous billing                                                                                                                                                                                                              | Medium                       |
| R8    | A fleet code on no hire order, on more than one, or on an order at another site; a job number on no order                                                                                                                                                                 | High / Medium                |
| R12   | The same product (identified by a fleet code, hired one at a time) at different weekly rates on orders started within six months of each other; once per item                                                                                                             | Low                          |
| R14   | A "last invoice" that is not the previous invoice held for the job                                                                                                                                                                                                        | Medium                       |
| R15   | A fleet code billed last month that is gone with no return invoice, or new on the job: confirm on site                                                                                                                                                                    | Medium / Low                 |
| R16   | A missing or wrong suspension credit on a site with a recorded suspension                                                                                                                                                                                                 | High / Medium                |
| R17   | A collection or delivery charged more than once for the same order                                                                                                                                                                                                        | Medium                       |

The monthly discrepancy report (`/reports/discrepancies?month=YYYY-MM`) lists every finding on the month's invoices, the amount overcharged on open findings, and the orders on hire with no invoice (R4). R11 is shown on each statement's page (`/statements`).

## Linking invoices to orders and sites

- **Our order number** is the key from an invoice to a hire order when the supplier prints it ("Order No" on contract-layout invoices); the supplier's job number is the fallback, and the only key on despatch-layout invoices, where "Our Ref" is the supplier's job number.
- **Fleet codes (E-codes)** link each invoice line to the item. When the supplier swaps an item, record its new code on the site page: the old code stays in the item's history, so invoices with either code link to the item, and the month-to-month check (R15) sees one item, not one gone and one unknown.
- **The site** of an invoice is the site of its linked order. An invoice with no order is matched by the customer reference (the spellings recorded on the site page, then the name and code), then by a spelling or the site name in the delivery address, then by the delivery postcode, and never by a guess between two sites.
- Lines are linked again automatically when an order, item or code is entered, so the result does not depend on the order data is entered in: a line linked to the only order with its fleet code moves to the invoice's own order once that exists (an item hired again on a new job).

## Reading invoice PDFs

On **Enter an invoice** (`/invoices/new`), choose the supplier's PDF and **Read PDF**: the form fills in, a list says what to check, and nothing is saved until you have checked the form and pressed **Save invoice**. The PDF is kept with the invoice (`INVOICE_FILES_DIR`, git-ignored) and opens from the invoice page.

- **No AI and no API key.** The suppliers' invoices are PDFs with text, so the app reads them with one template per layout (`src/lib/extraction`): the same result every time, fully tested, free. A scanned PDF, or a layout the app does not know, is kept and entered by hand.
- **Two layouts.** _Despatch_: "Label : value" headers, "Our Ref" is the supplier's job number, items grouped under despatch notes with the fleet code ("Ecode") on the row below, VAT by VAT code. _Contract_: "Order No" is our order number, "Contract No." the job, one block per item with the fleet code in brackets and "£72.00 per week for 4 weeks".
- **The supplier** is found by the account number printed on the invoice, so give each supplier its account number.
- **Nothing is guessed.** A field that cannot be read is left empty with a warning; lines that do not add up to the totals are reported. Credit notes become negative amounts, and a suspension credit printed under an item becomes a negative hire line for that item (what R16 looks for).
- **How the PDF is read.** A PDF stores text as pieces placed on the page. The app puts them back into rows by height and into columns by the gaps between them (`src/lib/extraction/pdf-lines.ts`), then each template reads values by their labels and columns.

**Many at once.** On **Upload invoices** (`/invoices/upload`), choose a month's PDFs: they are sent one at a time, with the progress and each result listed. An invoice read cleanly (known layout, no warnings, supplier found, not recorded yet) is saved with its PDF and checked. One already recorded is skipped. Any other waits on **To check** (`/invoices/review`): it opens in the invoice form with what was read, and the fields the PDF did not give are marked, so nothing doubtful is saved unseen. Tried locally on a real month: 40 PDFs, all saved in 2 seconds, matching the spreadsheet and the statement to the penny.

The tests use fictional documents written in the two layouts, as text and as generated PDFs (`tests/support/invoice-documents.ts`). The templates were also checked locally on the real invoices, which never leave the local machine.

## Supplier statements

A supplier statement lists the invoices the supplier considers still open on its date. On **Statements**, import the PDF: the app reads it (the despatch supplier's layout), finds the supplier by the account number printed on it, refuses it if its lines do not add up to its total, and keeps the file. The statement page then shows, worked out against the invoices held now:

- **Not in Hire Tracker**: an invoice on the statement that was never received. Ask the supplier for a copy.
- **Amount differs**: the statement and the invoice disagree.
- **Not on the statement**: an invoice we hold as unpaid, dated before the statement, that the supplier no longer lists. It has been paid or settled; one button marks them all paid.
- **Paid, still listed**: an invoice we marked paid that is still open on the latest statement. Check the payment reached the supplier.

Because the comparison is worked out each time, entering a missing invoice later clears its problem. Checked locally on eight months of real statements and invoices: every line on every statement found, every amount equal, and every invoice on at least one statement.

## Cost reports

- **Monthly costs** (`/reports/costs`): the month's net cost by site and trade, as on the cost allocation sheet, with the lines behind each site. An invoice belongs to the month of its date. A line takes its own trade, else its order's; lines with neither are shown as "No trade", and invoices with no site as "No site", never guessed.
- **Exports:** every line as CSV, an Excel workbook (summary and lines), or a ZIP with one folder per site (`RVS - Riverside Tower/`) holding its invoice PDFs and a `summary.csv`.
- **Yearly totals** (`/reports/yearly`): each site's gross cost by month, with month and year totals, as CSV or Excel.
- **They add up to the invoices.** When a supplier rounded VAT once on the total, the penny difference goes to the invoice's largest lines, so every report matches the invoices as printed. Sums are kept in pence.

## Damage on site, query emails and alerts

- **Services, repairs, damage and losses** are recorded on the site page. A charge for damage, loss, repair or service must match one (R9): the real invoices show charges for lost and damaged parts that nobody on site had confirmed.
- **Query emails.** The invoice page and the monthly report draft a query to the supplier from the open findings: each finding, what it overcharged, and the total. Gaps in our own records (a job we have no order for, an unknown site) are left out. The draft can be edited, copied or opened in your email app; the app never sends anything.
- **Alerts** (`/alerts`): items on hire for 12 weeks or more (still needed?), items that have cost £1,000 or more (buy instead?), and off-hired items not collected after 7 days. The limits can be changed on the page.

## Filters

Suppliers are kept apart wherever it matters (linking, checks, statements, query emails); the pages that add them together can be narrowed down:

- **Invoices:** supplier, site, month, payment status, only those with open findings.
- **Discrepancy report and its query emails, monthly and yearly costs (and their downloads), alerts:** supplier and site.

Every filter is a query parameter of the API too; an empty value means "all".

## Demo data

`npm run db:reset` loads two suppliers. Summit Access Ltd (account HT014, 20% damage waiver, 30 days) has no data yet: it is there to read contract-layout invoices. Apex Plant Hire (account APX-000123) comes with 3 sites, 4 hire orders, 12 invoices from July to September 2026, a damage recorded on site and the 1 October statement. The data goes through the app's own services, and it deliberately contains supplier mistakes. An API test checks that every implemented rule finds at least one of them.

| Invoice                         | Site     | Mistake                                                                                                                    | Found by     |
| ------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- | ------------ |
| APX-20703, APX-20819, APX-20820 | NGW, RVS | The same outrigger adaptor at £3.50/week and £3.75/week                                                                    | R12          |
| APX-20817                       | RVS      | Lift billed at £52.50/week instead of £50.00                                                                               | R6           |
| APX-20817                       | RVS      | "Last invoice" APX-20799 is not the previous invoice                                                                       | R14          |
| APX-20817                       | RVS      | Pipe groover no longer billed, with no return invoice                                                                      | R15          |
| APX-20819                       | RVS      | Platform billed from 10 Aug, delivered 13 Aug                                                                              | R2           |
| APX-20819                       | RVS      | Billed to 31 Aug after the 27 Aug off-hire, then credited by C-20901                                                       | R1, resolved |
| APX-20819                       | RVS      | VAT £9.01 on a £45.00 delivery                                                                                             | R10          |
| APX-20820                       | NGW      | No credit for the 10-day site suspension                                                                                   | R16          |
| APX-20820                       | NGW      | Generator APX-GN-0099 is on no hire order                                                                                  | R8, R15      |
| APX-20820                       | NGW      | Damage waiver £50.00 instead of £47.67                                                                                     | R13          |
| APX-20830                       | MLP      | Collection charged twice                                                                                                   | R17          |
| APX-20905                       | RVS      | Lift billed again for 15-31 Aug, at the wrong rate                                                                         | R3, R5       |
| APX-20931                       | MLP      | Continuation after the return invoice, a month after off-hire                                                              | R7, R1       |
| September report                | RVS, NGW | J100101 and J100301 on hire with no September invoice                                                                      | R4           |
| APX-20940, APX-20941            | RVS, NGW | Damage charges: on RVS nothing recorded on site; on NGW the damage the site recorded matches                               | R9           |
| Statement of 1 October          |          | APX-20850 never received; APX-20819 listed £10.00 higher; APX-20703 paid but still listed; APX-20830 unpaid but not listed | R11          |

July is paid, APX-20820 is queried, and the rest is unpaid, which fills the payments page.

## Continuous integration

GitHub Actions runs on every pull request and on every push to `main` (`.github/workflows/ci.yml`):

- **Lint, typecheck and unit tests**: ESLint, Prettier check, TypeScript, Vitest.
- **API and E2E tests**: Playwright builds the production app, starts it, then runs the API and E2E tests against it. The HTML reports are uploaded as the `playwright-report` artifact of each run.

## Configuration

Environment variables are documented in `.env.example`. Copy it to `.env` for local settings. `.env` is never committed. Uploaded PDFs go to `INVOICE_FILES_DIR` (default `storage/invoice-files`), which is git-ignored; the tests use `storage/test-invoice-files` and empty it before each run.

Status: Phases 0 to 7 done: the charge calculator, sites and orders, invoices, the reconciliation checks R1 to R17, reading invoice PDFs, supplier statements, cost reports with exports, damage on site, query emails and alerts. Next: the optional Phase 8 and the polish of Phase 9. All data in this repository is fictional.
