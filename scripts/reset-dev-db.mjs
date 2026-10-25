// Recreates the development database: deletes it, applies every migration and adds the demo
// data. Only for the local development database: it refuses any file not named dev.db.
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const DEV_DB_FILE = "prisma/dev.db";
const url = `file:./${DEV_DB_FILE}`;
if (process.env.DATABASE_URL && process.env.DATABASE_URL !== url) {
  throw new Error(`Refusing to reset ${process.env.DATABASE_URL}: this script only resets ${url}`);
}

for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DEV_DB_FILE}${suffix}`, { force: true });
}
const env = { ...process.env, DATABASE_URL: url };
execSync("npx prisma migrate deploy", { stdio: "inherit", env });
execSync("npx prisma db seed", { stdio: "inherit", env });
