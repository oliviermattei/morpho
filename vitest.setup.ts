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

// jsdom implements no `window.matchMedia` at all (it is on jsdom's own
// "not implemented" list). Embla — the engine behind ui/carousel.tsx,
// which /graphes now mounts — calls it unconditionally while activating,
// so without this every test that renders the charts panel dies with
// "undefined is not a function" inside OptionsHandler, before a single
// assertion runs.
//
// The stub reports "does not match" for every query, which is the right
// answer here: Embla only consults it for the responsive `breakpoints`
// option, and this project passes none — so the base options are the
// ones that should apply. Same `??` guard and the same reasoning as the
// Element no-ops above, including the `typeof` check for the node-
// environment test files that have no `window`.
if (typeof window !== "undefined") {
  window.matchMedia =
    window.matchMedia ??
    ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
}

// Same gap, same component, one layer further in: Embla constructs an
// IntersectionObserver while initialising (SlidesInView), and jsdom
// implements none. The stub observes nothing and reports nothing, which
// leaves every slide "not in view" — harmless for these tests, which
// assert on the rendered cards, not on Embla's own visibility bookkeeping.
//
// Deliberately NOT the ResizeObserver polyfill s07's plan refuses for
// ChartContainer (P5): that one would have faked a LAYOUT the assertions
// then depended on. This only makes the component mount at all.
if (typeof globalThis.IntersectionObserver === "undefined") {
  class IntersectionObserverStub implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    // Added to the spec after rootMargin, and required by the DOM lib defs
    // from TypeScript 7 on. Same empty value as rootMargin: the stub
    // observes nothing, so no margin it reports can matter.
    readonly scrollMargin = "";
    readonly thresholds: readonly number[] = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalThis.IntersectionObserver = IntersectionObserverStub;
}

// And the third observer Embla constructs on init (ResizeHandler).
//
// s07's P5 and its research note refuse a ResizeObserver polyfill "sans
// nécessité démontrée". The necessity is now demonstrated: Embla throws
// on mount without one, so /graphes cannot be rendered in a test at all.
//
// This stub REPORTS A SIZE, and that detail is the whole difference
// between a working polyfill and the one P5 was right to refuse. Recharts'
// ResponsiveContainer skips its observer entirely when ResizeObserver is
// undefined, and keeps ChartContainer's `initialDimension` — which is why
// charts were testable here before. The moment the global exists it takes
// the observer path instead, and a stub that stayed silent would leave it
// waiting on a measurement that never comes: every chart renders an empty
// div and every SVG assertion in this repo fails (reproduced — 14 tests).
//
// So it emits exactly ChartContainer's own INITIAL_DIMENSION, 320 × 200
// (chart.tsx:12). The charts therefore measure precisely what they
// already assumed, and no existing geometry assertion moves. jsdom still
// computes no real layout: this is a fixed, declared size, not a fake
// one derived from a fake layout.
if (typeof globalThis.ResizeObserver === "undefined") {
  const CHART_CONTAINER_INITIAL_DIMENSION = { width: 320, height: 200 };

  class ResizeObserverStub implements ResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}

    observe(target: Element) {
      const { width, height } = CHART_CONTAINER_INITIAL_DIMENSION;
      const contentRect = {
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRectReadOnly;
      const box: ResizeObserverSize[] = [
        { inlineSize: width, blockSize: height },
      ];
      this.callback(
        [
          {
            target,
            contentRect,
            borderBoxSize: box,
            contentBoxSize: box,
            devicePixelContentBoxSize: box,
          },
        ],
        this,
      );
    }
    unobserve() {}
    disconnect() {}
  }

  globalThis.ResizeObserver = ResizeObserverStub;
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
