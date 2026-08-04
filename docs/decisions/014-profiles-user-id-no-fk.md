# ADR 014 — `profiles.user_id` references `neon_auth."user"`, without a database-level foreign key

- Status: superseded by 015
- Date: 2026-08-03
- Scope: story s04

> **Superseded (review finding 1).** This ADR's premise — that emitting a
> real `REFERENCES` constraint against `neon_auth."user"` requires
> **exporting** the `authUser` fixture — is false: `.references()` is a
> call on the column builder and needs no export, as
> `measurement_sessions.user_id` (declared 60 lines above this ADR's own
> subject, in the same schema file) already proved before this ADR was
> written. What was actually measured is the effect of *exporting*
> `authUser`, generalized here to a claim about *referencing* it at all.
> See ADR 015 for the corrected measurement and decision.

## Context

s04 introduces `profiles`, the first `public` table whose primary key
*is* the Neon Auth user id (`user_id uuid primary key`), rather than a
table that merely has a foreign key column pointing at one
(`measurement_sessions.user_id`, s03). `docs/decisions/003-neon-auth.md`
says a foreign key "vise `neon_auth."user"(id)` en `uuid`", without
settling whether that has to be a real, database-enforced constraint.

Measured on this branch (drizzle-kit 0.31.10, `schemaFilter: ["public"]`
in `drizzle.config.ts`, disposable spike worktree, discarded after): the
only way to make Drizzle emit an actual `REFERENCES` constraint against
`neon_auth."user"` is to declare that table on the Drizzle side via
`pgSchema("neon_auth").table("user", …)` — exactly what
`src/lib/db/schema.ts` already does, as a non-exported `const`, for
`measurement_sessions.user_id`'s own FK (s03, decision 1 bis). Declaring
it a second time for `profiles` changes nothing about that risk: the
moment the declaration is **exported** — which `pgTable`'s own extra-config
callback needs, to reference the column from `check()`/`references()` in
another table — `drizzle-kit generate` serializes it into
`CREATE TABLE "neon_auth"."user" ("id" uuid PRIMARY KEY NOT NULL);` before
the `ALTER TABLE "profiles" ADD CONSTRAINT … REFERENCES "neon_auth"."user"("id")`
line, **despite** `schemaFilter: ["public"]`. `schemaFilter` filters what
drizzle-kit treats as *this project's* schema to manage (diff, drop,
alter); it does not filter a table referenced only for its foreign key.
On a database where `neon_auth."user"` already exists (every real Neon
Auth database, including this project's), `db:migrate` fails outright
("relation already exists"). On a hypothetical fresh database, it would
silently create a phantom table shadowing Neon Auth's own —
`morpho/AGENTS.md`'s absolute rule ("no migration may touch `neon_auth`"),
broken by a normal-looking `references()` call.

## Decision

`profiles.user_id` is declared `uuid("user_id").primaryKey()`, with no
`.references()` call at all. The generated migration is exactly
`CREATE TABLE "profiles" ("user_id" uuid PRIMARY KEY NOT NULL, "height_cm" numeric(4, 1));`
— verified in the same spike, schema restored afterward with
`drizzle-kit generate` reporting "No schema changes, nothing to migrate".
Referential integrity toward `neon_auth."user"` is enforced by
application code only: every write path that inserts or updates a row in
`profiles` does so with a `user_id` read exclusively from
`getAuth().getSession()` (`morpho/AGENTS.md`), never from client input,
so an orphaned or forged row is not reachable through the app's own
surface.

**Scope: `profiles` only.** `measurement_sessions.user_id` keeps the real
FK s03 already declared and shipped — this ADR does not touch it, and
does not generalize a "no FK toward `neon_auth`" rule to the rest of
`public`. Whether other tables should follow `profiles`'s shape or
`measurement_sessions`'s is a decision above this story's scope (plan
s04, "Décisions au-dessus de ce plan", point 1) and is left open for a
framing ADR that looks at every `public` table at once, not one written
piecemeal per story.

## Considered options

- **FK declared via `pgSchema("neon_auth").table("user", …)`, exported so
  `profiles`'s extra-config can reference it** — rejected. Measured:
  `drizzle-kit generate` emits `CREATE TABLE "neon_auth"."user"` despite
  `schemaFilter: ["public"]`, which either breaks `db:migrate` on the real
  database (table already exists) or, worse, would silently shadow Neon
  Auth's own table on a fresh one. This is exactly the failure mode
  `src/lib/db/schema.ts`'s existing, non-exported `authUser` const and its
  locking test (`schema.test.ts`) already guard against for
  `measurement_sessions` — reusing an *exported* version of the same
  pattern for `profiles` would reopen it.
- **FK added by a hand-written migration, schema left without
  `.references()`** — rejected. The migration would be correct SQL, but
  Drizzle's own snapshot (`drizzle/meta/*.json`) would never know the
  constraint exists: every subsequent `drizzle-kit generate` diffs against
  a snapshot that is now permanently wrong, and would either try to
  re-add the constraint (failing, "already exists") or silently miss real
  future changes to `profiles`. A migration file this project's own
  tooling can't reason about is a liability every story after s04 would
  inherit.
- **No foreign key, integrity enforced in application code only** —
  accepted. `profiles` is written to by exactly one path
  (`PUT /api/profile`, task 7), which reads `user_id` exclusively from the
  verified session — the same non-negotiable rule that already protects
  `measurement_sessions` and `measurements` against a forged identity.

## Consequences

Easier: `db:generate` and `db:migrate` behave exactly like any other
schema change to a `public`-only table — no spike, no custom migration,
no snapshot drift. `profiles` can be read and written with the same
`AppDatabase`-typed functions (`src/lib/db/index.ts`) as every other
table, in production and on PGlite (ADR 009) alike.

Harder: deleting a user from `neon_auth."user"` (a flow the PRD does not
describe and no story implements) would leave an orphaned `profiles` row
behind — nothing at the database level would refuse or cascade it. This
is the same trade-off `measurement_sessions.user_id`'s real FK avoids for
that table (`ON DELETE CASCADE`), accepted here only because `profiles`
cannot express it without breaking the absolute rule above.

To watch: if a future story needs Postgres-level cascade-on-user-deletion
for `profiles`, that is grounds for revisiting this ADR (superseding it),
not for quietly adding `.references()` back in.
