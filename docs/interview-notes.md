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
