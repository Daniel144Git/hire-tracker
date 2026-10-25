import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Playwright test server builds into its own folder, so it can run next to `npm run dev`.
  // Set only when asked for: an explicit distDir of ".next" makes `next dev` reload pages in an
  // endless loop with Next.js 16.4 (issue #5).
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Next.js 16.4 Turbopack regression: with the persistent dev cache, a page opened after an API
    // route was compiled reloads in an endless loop (issue #7, vercel/next.js#100251).
    // Remove once a Next.js release includes the fix.
    turbopackFileSystemCacheForDev: false,
  },
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
