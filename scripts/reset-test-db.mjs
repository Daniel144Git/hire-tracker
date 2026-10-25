// Creates an empty test database with all migrations applied.
// Playwright runs this before starting the app, so every test run starts from a clean database.
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const TEST_DB_FILE = "prisma/test.db";
const url = process.env.DATABASE_URL ?? `file:./${TEST_DB_FILE}`;
if (!url.endsWith("test.db")) {
  throw new Error(`Refusing to reset "${url}": the test database file must end with test.db`);
}

for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${TEST_DB_FILE}${suffix}`, { force: true });
}
execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
