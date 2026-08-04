# ADR 009 — PGlite for the isolation and constraint tests

- Status: accepted
- Date: 2026-08-03
- Scope: story s03

## Context

s03 introduces the first real business schema (`measurement_sessions`,
`measurements`) and the first tests that need to prove something SQL
enforces: the `(session_id, kind)` uniqueness, the `value > 0` check, the
foreign key to `neon_auth."user"`, and — the story's own criterion 7 —
that `listMeasurementSessions()` filters strictly on `user_id` when user A
and user B both have rows in the same table.

ADR 005's complement leaves this open explicitly: "le mécanisme — base
Neon dédiée, branche Neon éphémère, ou conteneur Postgres local — reste à
trancher en `/ks-research s03`." The environment this story runs in has
none of `docker`, `psql`, a Neon CLI, or a Vercel CLI (research, Blockers
§8) — a local Postgres container and an ephemeral Neon branch are both
inexploitable here. More importantly: ADR 005's complement requires
`npm run check` to stay green **without any secret**, in any environment,
including a fresh clone. A test that requires `DATABASE_URL` cannot live
in that gate, so a shared or ephemeral Neon database would pull the
isolation test out of the TDD loop it exists to guard.

## Decision

**PGlite** (`@electric-sql/pglite`, driver `drizzle-orm/pglite`, already a
peer dependency of the installed `drizzle-orm`). `src/lib/db/
test-database.ts` exposes `createTestDatabase()`: it starts an in-process
PGlite instance, creates a fixture `neon_auth."user"(id uuid primary key,
email text not null)` by raw SQL (never through drizzle-kit — this is not
a migration, and must not contradict `schemaFilter: ["public"]`), then
applies the **real, generated** migration from `drizzle/` via
`migrate()`. It returns `{ db, seedUser() }`.

`db` is typed `PgliteDatabase`, which — like `NeonHttpDatabase` in
production — extends `PgDatabase<PgQueryResultHKT>` (plan decision 21,
`src/lib/db/index.ts`'s `AppDatabase`). Every read-only function this
story and the ones after it write takes that type, so the same function
runs against PGlite in tests and against Neon in production without a
cast. `batch()` is not exposed by the harness — it only exists on
`NeonHttpDatabase` (plan decision 10), and the write path is not what
these tests exercise.

## Considered options

- **An ephemeral Neon branch per test run** — rejected. No Neon CLI or API
  key is available in this environment (research, Blockers §8), and even
  where one exists, a secret-gated test cannot live in `npm run check`
  without breaking ADR 005's "green with no secret" requirement.
- **A dedicated Neon database, behind `npm run check:db`** — rejected as
  the *primary* path, kept as the explicit fallback below. It would move
  the isolation test — the one covering this story's own criterion 7 —
  out of the loop that runs on every commit, for every future story too.
- **A local Postgres container (Docker)** — rejected: `docker` is absent
  from this machine (research, Blockers §8), and depending on it would
  make `npm run check` fail to even start on a machine without Docker.
- **PGlite** — accepted. In-process, no network, no secret, and it runs
  the same generated migration the production database will see, not a
  hand-written approximation of the schema.

## Consequences

Easier: the isolation test for criterion 7, and the constraint tests for
uniqueness/check/FK, run inside `npm run check`, on every TDD loop, with
no setup beyond `npm install`.

Harder: PGlite embeds its own Postgres build — verified at
`PostgreSQL 18.3 (PGlite 0.5.4)` (`src/lib/db/test-database.test.ts`,
consigned by test) — while the project's real Neon database is
`PostgreSQL 18.4` (plan decision 1, verified by introspection). A DDL
statement that passes on PGlite is not a guarantee it passes on Neon,
only a strong signal; the reverse (Neon-only behavior PGlite can't
reproduce) is the risk this ADR accepts.

**Explicit fallback**, to be exercised if a migration doesn't apply on
PGlite: switch to a dedicated Neon database behind a separate
`npm run check:db` (the same shape as `check:leak`), and record that
switch as an amendment to this ADR — never bend the schema to make PGlite
happy. Not needed for this story: task 1's migration applies as-is
(`src/lib/db/test-database.test.ts`).

To watch: one PGlite instance is shared per test file (`beforeAll`)
rather than started per test — review s01 (finding A) sanctioned a
`npm run check` that drifted to 122s from a single unnecessarily heavy
per-test cost. Tests that share an instance key their rows with
`crypto.randomUUID()` rather than relying on truncation between tests.
