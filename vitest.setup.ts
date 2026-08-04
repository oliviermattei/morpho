import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// @testing-library/react auto-registers its own afterEach(cleanup) only
// when it finds a *global* `afterEach` (a bare `typeof afterEach` check —
// dist/index.js). vitest.config.mts doesn't set `test.globals: true`, so
// that check silently finds nothing and no cleanup ever runs: every
// render() in a file leaks into the next test's DOM, and queries like
// getByRole start matching multiple stale copies of the same element.
// Explicit and shared here rather than per test file, for every future
// component test in this project.
afterEach(() => {
  cleanup();
});

// jsdom implements neither scrollIntoView nor the Pointer Capture API
// (MDN, and reproduced here: Radix Select's own open-on-click effect
// calls `candidate.scrollIntoView()` on its highlighted item, which
// throws "not a function" the instant jsdom mounts it — before any
// missing pointer-capture check is even reached). This is not the
// ResizeObserver polyfill s07's plan explicitly refuses for
// ChartContainer (P5) — a different component, a different gap: every
// Radix popover-based primitive this project uses (select today,
// possibly combobox/dropdown-menu later) needs these four no-ops to be
// interactive under jsdom at all, so they belong here once rather than
// stubbed per test file.
// Guarded: files marked `@vitest-environment node` (every pure-logic and
// PGlite test in this repo) have no `Element` global at all — this file
// runs before that per-file environment is known to apply the guard to.
if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView =
    Element.prototype.scrollIntoView ?? (() => {});
  Element.prototype.hasPointerCapture =
    Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.setPointerCapture =
    Element.prototype.setPointerCapture ?? (() => {});
  Element.prototype.releasePointerCapture =
    Element.prototype.releasePointerCapture ?? (() => {});
}

// @neondatabase/auth/next/server imports `next/headers` at module scope.
// `next`'s package.json has no "exports" map, so Vite externalizes this
// node_modules-to-node_modules import straight to Node's strict ESM
// resolver, which can't resolve an extension-less deep import outside a
// real Next.js build/runtime ("Did you mean next/headers.js?"). Nothing in
// this project's tests exercises real cookies/headers through this path —
// every route handler test mocks @/lib/auth or the session it returns — but
// the top-level import still has to resolve for the module to load at all.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(), set: vi.fn() })),
  headers: vi.fn(async () => new Headers()),
}));
