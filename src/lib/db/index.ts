import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/**
 * Plan decision 21: the type every read-only function in this story (and
 * s04-s09) takes for its `db` parameter, instead of `any`, a driver union,
 * or a per-caller generic. NeonHttpDatabase (production) and PgliteDatabase
 * (src/lib/db/test-database.ts, task 2) are otherwise incompatible drivers,
 * but both extend PgDatabase<PgQueryResultHKT> — verified by typecheck: a
 * function typed `(db: AppDatabase, ...)` accepts either without a cast.
 * The write path keeps the concrete NeonHttpDatabase type instead — batch()
 * only exists there (decision 10), and it must not be exposed to the
 * PGlite-backed read tests.
 */
export type AppDatabase = PgDatabase<PgQueryResultHKT>;

const QUERY_TIMEOUT_MS = 5000;

/**
 * Creates the Neon SQL tag function, lazily and on every call — never
 * memoised. Two reasons:
 *
 * 1. `neon()` throws synchronously when DATABASE_URL is missing, which would
 *    break `npm run build` the same way createNeonAuth() does without a
 *    cookie secret (research, Trap 5; see src/lib/auth.ts for the same
 *    pattern) — so this must never run at module scope.
 * 2. `neon()` is a plain HTTP constructor with no connection pool to
 *    amortise, so there is no cost to paying it again per call. Review
 *    finding 1 (critical): a memoised client bakes its `fetchOptions` in at
 *    construction, including the AbortSignal below — the timer starts then,
 *    not at query time. On a warm serverless instance, every query issued
 *    more than QUERY_TIMEOUT_MS after the first one would abort before
 *    leaving the process. Constructing fresh, per call, keeps the signal's
 *    timer scoped to that call's actual request.
 */
export function getSql(): NeonQueryFunction<false, false> {
  return neon(process.env.DATABASE_URL!, {
    fetchOptions: { signal: AbortSignal.timeout(QUERY_TIMEOUT_MS) },
  });
}

/**
 * Same invariant as getSql(), one layer up: call this fresh, per request,
 * never `const db = getDb()` at module scope. drizzle() wraps whatever
 * getSql() returns, so memoising the result here would freeze in the same
 * AbortSignal getSql()'s docstring warns about — the exact critical bug
 * review finding 1 fixed, with the same profile (review s01 second pass,
 * finding D).
 */
export function getDb(): NeonHttpDatabase {
  return drizzle(getSql());
}
