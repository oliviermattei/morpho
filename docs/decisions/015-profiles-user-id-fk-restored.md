# ADR 015 — `profiles.user_id` references `neon_auth."user"` with a real database-level foreign key

- Status: accepted
- Date: 2026-08-03
- Scope: story s04
- Supersedes: ADR 014

## Context

ADR 014 rejected a database-level `REFERENCES` constraint from
`profiles.user_id` to `neon_auth."user"(id)`, on this premise: "the only
way to make Drizzle emit an actual `REFERENCES` constraint against
`neon_auth."user"` is to declare that table on the Drizzle side via
`pgSchema("neon_auth").table("user", …)` … the moment the declaration is
**exported** — which `pgTable`'s own extra-config callback needs … —
`drizzle-kit generate` serializes it into `CREATE TABLE "neon_auth"."user"`
… despite `schemaFilter: ["public"]`."

That premise is false, and the same file it appears in already refutes
it, sixty lines above: `measurement_sessions.user_id` carries
`.references(() => authUser.id, { onDelete: "cascade" })`, with
`authUser` declared as a **non-exported** `const`
(`pgSchema("neon_auth").table("user", …)`), and `drizzle/0000_busy_rocket_racer.sql`
shows the resulting `ALTER TABLE … REFERENCES "neon_auth"."user"("id")`
with no `CREATE TABLE "neon_auth"` and no `CREATE SCHEMA` anywhere in the
migration. `.references()` is a call on the *column builder*; it needs a
value to close over (`() => authUser.id`), not an export — nothing about
resolving that closure requires `authUser` to leave the module.

What ADR 014 actually measured (review finding 1, reproduced): the
`CREATE TABLE "neon_auth"."user"` only appears when `authUser` is
**exported**. That is the s03 spike the plan's decision R2b cites — it
generalized a fact that was true of *exporting* the fixture into a claim
about *referencing* it at all, and ADR 014 repeated the same
generalization for `profiles`. Re-measured on this branch (drizzle-kit
0.31.10, `schemaFilter: ["public"]`, `authUser` left non-exported, only
change `.references(() => authUser.id, { onDelete: "cascade" })` added to
`profiles.userId`): the generated migration is exactly

```sql
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;
```

— zero occurrences of `CREATE TABLE "neon_auth"`, zero of `CREATE SCHEMA`.
`src/lib/db/schema.test.ts` locks both facts as generated-SQL assertions,
not assumptions about `schemaFilter`.

## Decision

`profiles.userId` is declared with `.references(() => authUser.id, { onDelete: "cascade" })`,
the same shape `measurement_sessions.userId` already has. `authUser`
stays a non-exported `const` — nothing about this change touches that
lock. Referential integrity toward `neon_auth."user"` is now enforced by
Postgres itself, and a user deleted from Neon Auth cascades to their
`profiles` row instead of leaving it orphaned — the trade-off ADR 014
accepted ("harder: … would leave an orphaned `profiles` row behind …")
no longer applies.

Applied to the real Neon database (migration `0002_sharp_loki.sql`,
`npm run db:migrate`) and verified by introspection immediately after:
`neon_auth` is still exactly 9 tables (`account`, `invitation`, `jwks`,
`member`, `organization`, `project_config`, `session`, `user`,
`verification`), unchanged from before the migration. `public.profiles`
now carries `profiles_user_id_user_id_fk`:
`FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE`,
alongside its pre-existing `profiles_pkey` and
`profiles_height_cm_range` constraints.

**Scope: `profiles` only**, same as ADR 014. Whether every other
`public` table should carry a real FK toward `neon_auth."user"` the same
way is still the framing decision plan s04 remitted to the orchestrator
(plan, "Décisions au-dessus de ce plan", point 1) — this ADR does not
reopen or settle that question, it only corrects the measurement ADR 014
made for `profiles`'s own case.

## Considered options

- **Leave ADR 014's decision in place, no FK** — rejected. The only
  argument for it was the false premise above; with the premise gone,
  there is no remaining reason to accept the orphaned-row trade-off ADR
  014's own "Consequences" section named as its cost.
- **FK declared via a second, exported `pgSchema("neon_auth")` table
  scoped to `profiles`** — rejected. Unnecessary: the existing
  non-exported `authUser` already resolves the reference; declaring a
  second copy would duplicate the fixture for no benefit and reopen the
  real risk (export triggers `CREATE TABLE "neon_auth"."user"`) that ADR
  014 was right to guard against, just wrong about how to guard against
  it.
- **FK added by a hand-written migration, schema left without
  `.references()`** — rejected, same reasoning ADR 014 already gave: the
  Drizzle snapshot would never know the constraint exists, and every
  later `drizzle-kit generate` would diff against a permanently wrong
  baseline.
- **`.references()` call, `authUser` left non-exported** — accepted.
  Matches `measurement_sessions.user_id`'s already-shipped shape exactly,
  verified by the same generated-SQL guard, no snapshot drift, no second
  fixture.

## Consequences

Easier: `profiles` and `measurement_sessions` are no longer asymmetric on
the same column pointing at the same table — both cascade on user
deletion, both are protected by the identical non-exported-`authUser`
guard and the identical generated-SQL test. A future account-deletion
flow (none exists yet) does not need to special-case `profiles`.

Harder: nothing new. The migration was additive (`ALTER TABLE … ADD
CONSTRAINT`), applied cleanly to the existing `profiles` rows on the real
database (empty at the time of migration, so no backfill question arose).

To watch: this ADR does not decide the framing question for the rest of
`public` (plan s04, point 1 above) — that decision, whenever it is made,
should reference this ADR's measurement rather than re-deriving it.
