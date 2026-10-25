import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Local default so `prisma generate` also works on a fresh clone without a .env file.
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  },
});
