import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Playwright fixtures call a function named `use`, which the React hooks rule mistakes for
    // React's use() hook. Tests contain no React components, so the rule does not apply there.
    files: ["tests/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  // Must come last: turns off ESLint rules that conflict with Prettier formatting.
  prettier,
  globalIgnores([
    ".next/**",
    ".next-test/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
    "blob-report/**",
    "src/generated/**",
  ]),
]);

export default eslintConfig;
