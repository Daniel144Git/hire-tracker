# Hire Tracker

Tracks equipment hired for construction sites and checks every hire invoice against what was actually on site: items, periods, rates, returns, credits and the supplier's statements.

Built as a test-automation portfolio project: the application is real, the test suite is the showcase (Vitest unit tests, Playwright API and E2E tests with Page Object Model, GitHub Actions CI with published reports).

- `docs/BRIEF.md` — what the app does, the business rules, the test strategy and the phases.

## Run locally

Requires Node.js 24 (see `.nvmrc`; with nvm, run `nvm use`).

```bash
npm install
npx playwright install chromium
npm run dev
```

Then open http://localhost:3000. The API and E2E tests start the app themselves if it is not already running.

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

## Continuous integration

GitHub Actions runs on every pull request and on every push to `main` (`.github/workflows/ci.yml`):

- **Lint, typecheck and unit tests**: ESLint, Prettier check, TypeScript, Vitest.
- **API and E2E tests**: builds the production app, then runs the Playwright API and E2E tests against it. The HTML reports are uploaded as the `playwright-report` artifact of each run.

## Configuration

Environment variables are documented in `.env.example`. Copy it to `.env` for local settings. `.env` is never committed.

Status: Phase 1 (charge calculator). The expected charge of a hire line and the damage waiver are calculated in `src/lib/charging`, built test-first. All data in this repository is fictional.
