import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Review finding 3: criterion 5's connection-string leak check needs a real
// DATABASE_URL and a build made with it, so it must never run as part of
// `npm run test` / `npm run check` — those have to stay green without
// secrets, in any environment. This dedicated config's `include` targets
// only that check (excluded from the default config's `*.test.{ts,tsx}`
// glob by its own `.check.ts` name), so `npm run check:leak` runs it in
// isolation. See src/build-connection-leak.check.ts.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/build-connection-leak.check.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
});
