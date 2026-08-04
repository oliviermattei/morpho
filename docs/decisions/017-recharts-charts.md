# ADR 017 — Recharts 3.8.0 for the measurement charts

- Status: accepted
- Date: 2026-08-03
- Scope: story s07

## Context

s07 needs a real time-series line chart (criteria 1, 2, 6, 7 of `docs/stories.md`), rendered
on iOS Safari at 375px, that reads the app's OKLCH tokens instead of a library's own hard-coded
colors. The story's agentic notes explicitly ask for the mobile-performance question to be
settled here if it cannot be measured directly, rather than left implicit.

`docs/design-system.md` already attributes the `chart` component (a `ChartContainer` wrapper
around Recharts) to s07, and the `@shadcn` registry (style `radix-nova`) pins it to a specific
Recharts version. `compoundSimulator/` (a different, unrelated app in this monorepo) already
depends on `recharts@2.15.4` — a different major version, not a precedent to copy API behavior
from.

Recharts pulls a non-trivial runtime dependency tree: 11 packages, read directly from the
installed package's own `package.json` — `@reduxjs/toolkit`, `react-redux`, `immer`, `reselect`,
`victory-vendor`, `es-toolkit`, `decimal.js-light`, `eventemitter3`, `tiny-invariant`,
`use-sync-external-store`, `clsx` (the last one already present via `tailwind-merge`'s own use,
but pulled again as Recharts's direct dependency). This matters because s10 will put this app's
shell under a service worker cache.

## Decision

**Recharts 3.8.0, installed as the `chart` shadcn component** (`npx shadcn@latest add chart`),
never a hand-copied JSON — the registry's `iconLibrary: "lucide"` rewrite and the CLI's own
dependency resolution are not reproducible by hand.

Verified at install time: the registry still pins `recharts@3.8.0`
(`curl https://ui.shadcn.com/r/styles/radix-nova/chart.json`), and `node_modules/recharts`
installed at that exact version. The plan's props (`XAxis`/`YAxis` defaults, `ReferenceLine`
defaults, `ChartTooltipContent`'s `labelFormatter` argument) were re-verified against the
installed package's own `es6/` sources and `types/` declarations before being used in code —
not assumed from the plan's own citations, and not copied from `compoundSimulator/`'s 2.15.4.

**The `"use client"` boundary stays on the two chart components only**
(`MeasurementChart.tsx`, `MeasurementChartsPanel.tsx`). No other route or Server Component
imports Recharts, directly or transitively — the home screen's bundle stays free of it
(verified by `src/lib/build-output.test.ts`'s existing scan, which the story's task 10 rechecks
after a full build).

## Considered options

- **Recharts via the shadcn `chart` item (chosen)** — the design system already assigns it, the
  registry's version is verified current, and it is the only option that reads the project's
  design tokens for the stroke color through `ChartContainer`'s `config` without a hand-rolled
  bridge.
- **A hand-written applicative SVG** — the story's design mockup draws one for reference, but
  reproducing a real, irregular temporal scale, tick placement, a tap-driven tooltip and basic
  accessibility by hand is a second charting engine to build and maintain for a single screen.
  Rejected: the cost is the whole story's scope again, for a result the registry already
  provides.
- **A different charting library outside the shadcn registry** — rejected: it would sit outside
  the design system's component table, which only ever wraps Recharts for this preset. Every
  other primitive in this project comes from the same registry; introducing a second charting
  dependency for one screen is exactly the kind of gap `AGENTS.md` asks to be reported, not
  filled by importing something new.

## Consequences

Easier: the chart's color, typography and border tokens come from the same OKLCH variables as
the rest of the app, through `ChartContainer`'s `config` — no second palette to keep in sync.

Harder: 11 extra runtime dependencies ship in every bundle that imports `chart.tsx`, which is
why the `"use client"` boundary is drawn as tightly as the two chart components and asserted by
the existing build-output scan rather than trusted by convention.

To watch: if the registry's pinned Recharts version moves past 3.8.0 in a future story (s08,
s09), the props this ADR and `docs/plans/s07-measurement-charts.md` rely on (documented
per-line against the 3.8.0 source) must be re-verified against the new version before reuse —
this ADR does not carry forward automatically.
