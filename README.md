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

The API and E2E tests start their own server on port 3100 with a separate database (`prisma/test.db`), recreated empty for every run, so they never touch your demo data.

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

| Method and path                   | What it does                                        | Errors                        |
| --------------------------------- | --------------------------------------------------- | ----------------------------- |
| `GET /api/health`                 | Health check                                        |                               |
| `GET, POST /api/suppliers`        | List or create suppliers and their charging profile | 400, 409 duplicate name       |
| `GET, POST /api/sites`            | List or create sites                                | 400, 409 duplicate code       |
| `GET, PATCH /api/sites/:id`       | Get or edit a site                                  | 400, 404, 409                 |
| `GET /api/orders?siteId=&status=` | List hire orders, filtered by site and status       | 400                           |
| `POST /api/orders`                | Create a hire order with its items                  | 400, 409 duplicate job number |
| `GET, PATCH /api/orders/:id`      | Get an order, or change its trade or damage waiver  | 400, 404                      |
| `POST /api/orders/:id/items`      | Add an item or accessory to an order                | 400, 404                      |
| `POST /api/orders/:id/off-hire`   | Off-hire: date and optional collection number       | 400, 404, 409 not on hire     |
| `POST /api/orders/:id/collection` | Record the collection of an off-hired order         | 400, 404, 409 not off-hired   |

## Continuous integration

GitHub Actions runs on every pull request and on every push to `main` (`.github/workflows/ci.yml`):

- **Lint, typecheck and unit tests**: ESLint, Prettier check, TypeScript, Vitest.
- **API and E2E tests**: builds the production app, then runs the Playwright API and E2E tests against it. The HTML reports are uploaded as the `playwright-report` artifact of each run.

## Configuration

Environment variables are documented in `.env.example`. Copy it to `.env` for local settings. `.env` is never committed.

Status: Phase 3 (invoices and invoice lines). Earlier phases added the charge calculator (`src/lib/charging`, built test-first) and sites, hire orders and items. All data in this repository is fictional.
