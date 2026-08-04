# ADR 016 — Canonical ordering for "last known value per measurement"

- Status: accepted
- Date: 2026-08-03
- Scope: story s05

## Context

s05's whole story stands on one query: for a user, the last known value of
each of the 10 measurement kinds, independently of which session it came
from (ADR 004). That query is a `selectDistinctOn([measurements.kind], …)`
joined on `measurement_sessions`, and Postgres requires its `ORDER BY` to
start with the `DISTINCT ON` expression — `kind` — ascending, so the enum's
declared order is preserved for free.

What comes after `kind` is not free. `measured_on` is a **date**, not an
instant — two sessions sharing the same `measured_on` is the banal case
(s03 decision 14: two weigh-ins the same day, or a correction), not an
edge case to wave away. `ORDER BY kind, measured_on DESC` alone is
non-deterministic whenever that tie happens: which of the two rows Postgres
returns is unspecified, and can differ between two executions of the exact
same data. A prefilled form that silently shows a different value on every
reload is worse than showing the wrong one consistently — the user cannot
even tell there's a problem to report.

## Decision

`ORDER BY kind, measured_on DESC, created_at DESC, id DESC`, on
`measurement_sessions`. `getLatestValueByKind`
(`src/lib/db/latest-measurements.ts`) implements exactly this.

**s06 is this ADR's mirror in `ASC`, `id` included.** s06's own plan
(decision 12) stops at `measured_on, created_at` for the "first ever
recorded" query the silhouette's deltas are baselined against — two
criteria, not three. That plan is not amended by this ADR (it belongs to a
different story), but the plan under `docs/plans/s06-body-map.md` must add
the third criterion when it is implemented, for the same reason this ADR
exists: without it, s06's baseline is exactly as non-deterministic as s05's
prefill would have been.

## Considered options

- **`measured_on` alone** — rejected. Non-deterministic on any pair of
  same-day sessions, which s03 explicitly allows to happen. Silently
  reproduces a bug that only shows up months later, on a reload that picks
  the other row.
- **`created_at` alone** — rejected in the other direction. An
  intentionally antedated session, entered today for a date last week (a
  correction, or a forgotten weigh-in logged late), would beat a
  genuinely more recent measurement simply because it was *typed* later.
  `measured_on` is the fact the user reports; `created_at` only breaks a
  tie on that fact, it does not outrank it.
- **`measured_on, created_at`, no `id`** — rejected: still not a total
  order. Two sessions can share both a `measured_on` and (rarely, but not
  impossibly, e.g. a `batch()` writing two sessions within the same
  millisecond, or a naive backfill) a `created_at`. Without a third,
  always-unique criterion, the order remains partial and the prefill can
  still flip between reloads on that residual tie.
- **`measured_on, created_at, id`** — accepted. `id` is a `uuid` primary
  key: always present, always unique, so this is the first criterion in
  the chain guaranteed to break every remaining tie. The order becomes
  total — the same input always produces the same output, which is what
  makes the prefill reproducible and therefore testable at all (plan task
  1's tie-break tests fail on any implementation missing a link in this
  chain).

## Consequences

Easier: the prefill (s05) and any future "first/last per measurement kind"
query (s06's baseline, s09's edit-in-place default) read the exact same
three-column chain and get a deterministic answer, with no query planner
non-determinism to debug six months from now.

Harder: nothing structural — no new column, no new index (plan decision
N3: the FK index s03 already places on `measurement_sessions` is
sufficient at this app's scale; revisit only past ~2,000 sessions for one
user).

To watch: any future story that writes a "most recent X per Y" query
against `measurement_sessions` must reuse this exact three-column chain
(or its `ASC` mirror) rather than re-deriving a shorter one — a plan that
stops at two criteria is silently reintroducing the same non-determinism
this ADR exists to close.
