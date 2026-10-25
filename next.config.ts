import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Playwright test server builds into its own folder, so it can run next to `npm run dev`.
  // Set only when asked for: an explicit distDir of ".next" makes `next dev` reload pages in an
  // endless loop with Next.js 16.4 (issue #5).
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
