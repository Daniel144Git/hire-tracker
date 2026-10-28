# Contributing

Thanks for taking a look. Issues and pull requests are welcome.

## Setup

Follow [Run locally](README.md#run-locally): Node.js 24, `npm install`, `npx playwright install chromium`, `cp .env.example .env`, `npm run db:reset`.

## Before opening a pull request

```bash
npm run lint
npm run typecheck
npm run format:check
npm test
npm run test:api
npm run test:e2e
```

CI runs the same checks on every pull request.

## Rules

- **Tests come with the change**, at the lowest level that can catch the bug: unit tests for business logic (`tests/unit`), API tests for endpoints (`tests/api`), E2E only for critical user flows (`tests/e2e`, through the page objects in `tests/e2e/pages`).
- **Tests are independent.** Each test creates its own data through the API; no test relies on another or on the order they run in.
- **No fixed sleeps** in Playwright, and locators by role, label or test id.
- **Fictional data only.** No real company names, invoice numbers, prices or addresses anywhere in the repository, including tests and screenshots. Use the fictional supplier (Apex Plant Hire) and sites (RVS - Riverside Tower).
- **No secrets** in the code: configuration goes through environment variables, documented in `.env.example`.
- **Conventional commits** (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `ci:`), one branch and one pull request per change.
