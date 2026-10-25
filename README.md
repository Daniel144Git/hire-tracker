# Hire Tracker

Tracks equipment hired for construction sites and checks every hire invoice against what was actually on site: items, periods, rates, returns, credits and the supplier's statements.

Built as a test-automation portfolio project: the application is real, the test suite is the showcase (Vitest unit tests, Playwright API and E2E tests with Page Object Model, GitHub Actions CI with published reports).

- `docs/BRIEF.md` — what the app does, the business rules, the test strategy and the phases.

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the development server |
| `npm run build` | Builds the production app |
| `npm run lint` | Runs ESLint |
| `npm run typecheck` | Generates Next.js route types, then runs the TypeScript compiler |

Status: Phase 0 (setup). All data in this repository is fictional.
