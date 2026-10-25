import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Lets tests import app code as "@/lib/..." exactly like the app does.
    tsconfigPaths: true,
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
