import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Playwright owns tests/e2e — Vitest must not try to run them.
    include: ["src/**/*.test.{ts,tsx}"],
    // Raised from the 5000 default. /profil's form grew a react-day-picker
    // calendar and two Radix dialogs, so its first render is a few seconds
    // on its own; at the default it passed when run alone and timed out
    // when the whole suite ran in parallel — a flake that says nothing
    // about the code. This is headroom for slow renders, not a licence for
    // slow tests: nothing here waits on a real network or a real timer.
    testTimeout: 20_000,
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
