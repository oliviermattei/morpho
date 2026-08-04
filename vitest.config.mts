import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Playwright owns tests/e2e — Vitest must not try to run them.
    include: ["src/**/*.test.{ts,tsx}"],
    server: {
      deps: {
        // @neondatabase/auth/next/server imports next/headers at module
        // scope. next's package.json has no "exports" map, so an
        // externalized (native Node ESM) load of that import fails outside
        // a real Next.js runtime. Inlining routes it through Vite's
        // resolver instead, where the vitest.setup.ts mock of next/headers
        // applies.
        inline: ["@neondatabase/auth"],
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
});
