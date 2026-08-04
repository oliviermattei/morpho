/// <reference lib="webworker" />
import { Serwist } from "serwist";
import type { PrecacheEntry } from "serwist";
import { selectRuntimeCaching } from "@/lib/pwa/cache-policy";

/**
 * s10 plan task 5, decision 18: the file-scoped `webworker` lib
 * reference above — NOT `tsconfig.json`'s global `lib` array, which
 * stays untouched. Elevating it globally would pass only thanks to
 * `skipLibCheck`, at the cost of silently ambiguating `self`,
 * `location`, `navigator` and `FormData` across the ENTIRE project.
 */
declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[];
};

/**
 * s10 plan task 5: this file is pure CABLING — it constructs no
 * strategy and writes no `cacheName` of its own. The routing table
 * lives in `src/lib/pwa/runtime-caching.ts` (task 4b); the dev/prod
 * switch lives in `src/lib/pwa/cache-policy.ts`'s `selectRuntimeCaching`
 * (decision 13) — `process.env.NODE_ENV` is substituted at bundle time
 * by the route's own `esbuildOptions.define` (task 5's route), never
 * read as a live value in the worker.
 *
 * Two options are deliberately never used here, each guarded by a
 * source-scan test (src/lib/source-scans.test.ts, reading this exact
 * file): the library's own bundled runtime-caching table (decision 2 —
 * a persistent `GET /api/*` cache by construction, ADR 018), and the
 * offline-analytics switch (the one option that would make Serwist's
 * embedded, otherwise-dead Google Analytics code reachable, task 8).
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: selectRuntimeCaching(process.env.NODE_ENV),
  // Decision 15: the precache carries no HTML page — /~offline is what a
  // route never visited online falls back to.
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
