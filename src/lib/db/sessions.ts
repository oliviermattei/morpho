import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { z } from "zod";
import type { AppDatabase } from "./index";
import { measurements, measurementSessions } from "./schema";
import { MEASUREMENT_CATALOG, type MeasurementKind } from "../measurements";

export interface SessionForUser {
  id: string;
  measuredOn: string;
  createdAt: Date;
  measurements: Partial<Record<MeasurementKind, number>>;
}

/**
 * s09 plan task 3: the query getSessionForUser is built on, exported
 * separately (same motif as src/lib/db/latest-measurements.ts's
 * boundaryValuesByKindQuery) so a test can assert on `.toSQL()` without
 * executing it — the property scope (P2) has to be visible in the SQL
 * itself, not just trusted from reading the source.
 *
 * `db` is the first positional parameter (s03 decision 21) so this runs
 * unmodified against PGlite (tests) and Neon (production). A LEFT JOIN,
 * not an INNER JOIN: a session that legitimately carries zero
 * measurements right now (mid-edit, before the "at least one" guard
 * would refuse the save) must still resolve to a row, not to "not
 * found" — the join's empty side (kind/value both null) is what
 * mapMeasurementRows below skips.
 */
export function sessionForUserQuery(
  db: AppDatabase,
  { sessionId, userId }: { sessionId: string; userId: string },
) {
  return db
    .select({
      sessionId: measurementSessions.id,
      measuredOn: measurementSessions.measuredOn,
      createdAt: measurementSessions.createdAt,
      kind: measurements.kind,
      value: measurements.value,
    })
    .from(measurementSessions)
    .leftJoin(
      measurements,
      eq(measurements.sessionId, measurementSessions.id),
    )
    .where(
      and(
        eq(measurementSessions.id, sessionId),
        eq(measurementSessions.userId, userId),
      ),
    );
}

// AGENTS.md: "Read Drizzle numeric columns as numbers, not strings — a
// value arriving as '72.40' silently breaks deltas and chart axes." The
// schema's numeric(...,{mode:"number"}) column mapping already
// guarantees this in practice (locked by schema.test.ts) — this is the
// explicit boundary guard anyway: a defensive check that fails loudly
// instead of letting a future regression (a raw query bypassing the
// column mapping, a mode flip) reach the app as a silently-broken string.
const measurementValueSchema = z.number().finite();

/**
 * Pure, exported for its own test (task 3(b)): mapMeasurementRows is
 * where sessionForUserQuery's flat rows become the
 * Partial<Record<MeasurementKind, number>> shape getSessionForUser
 * returns. A kind whose value never arrives (the LEFT JOIN's empty side,
 * or a kind this session never recorded) gets no key at all — never a
 * fabricated 0 or null (ADR 004).
 */
export function mapMeasurementRows(
  rows: readonly { kind: MeasurementKind | null; value: unknown }[],
): Partial<Record<MeasurementKind, number>> {
  const result: Partial<Record<MeasurementKind, number>> = {};
  for (const row of rows) {
    if (row.kind === null || row.value === null) continue;
    result[row.kind] = measurementValueSchema.parse(row.value);
  }
  return result;
}

/**
 * s09 plan task 3: reads one session by identifier AND by owner in the
 * same query — R6's 404 semantics start here: a session that doesn't
 * exist and a session that isn't the caller's own both resolve to `null`,
 * indistinguishably. `userId` has no default and must come from
 * `getAuth().getSession()` at the caller, never from client input
 * (AGENTS.md). `getDb()` is always called by the caller, in the request,
 * never at module scope here (s01 review finding D).
 */
export async function getSessionForUser(
  db: AppDatabase,
  { sessionId, userId }: { sessionId: string; userId: string },
): Promise<SessionForUser | null> {
  const rows = await sessionForUserQuery(db, { sessionId, userId });
  const first = rows[0];
  if (!first) {
    return null;
  }

  return {
    id: first.sessionId,
    measuredOn: first.measuredOn,
    createdAt: first.createdAt,
    measurements: mapMeasurementRows(rows),
  };
}

/**
 * s09 plan task 4, R8 bis: the pure, PGlite-testable half of the write
 * path — three named instructions built against the ABSTRACT AppDatabase
 * type, each carrying its own property scope (P3, P2) rather than
 * relying on a shared transaction to enforce it. `db.d.ts:256`: "Calling
 * this method without .where() clause will delete all rows in a table."
 * — on the story whose whole point is deletion, that is not a
 * theoretical remark.
 */
export function buildUpdateSessionStatements(
  db: AppDatabase,
  {
    sessionId,
    userId,
    measuredOn,
    values,
  }: {
    sessionId: string;
    userId: string;
    measuredOn: string;
    values: Partial<Record<MeasurementKind, number>>;
  },
) {
  const ownedByCaller = and(
    eq(measurementSessions.id, sessionId),
    eq(measurementSessions.userId, userId),
  );

  // ① measured_on only — created_at is immutable (R4): a correction never
  // reorders the history's departage.
  const updateSession = db
    .update(measurementSessions)
    .set({ measuredOn })
    .where(ownedByCaller)
    .returning({ id: measurementSessions.id });

  const presentKinds = Object.keys(values) as MeasurementKind[];

  // ② the kinds no longer desired. R9/P3: omitted only when `values`
  // covers all 10 kinds — the predicate would then be vacuous, not
  // invalid — never merely because `values` is empty (that path is
  // refused by updateSessionForUser's own guard below, before this
  // function is ever called). Scoped by a subquery, not a shared
  // transaction: `inArray` over `scopedSessionIds` re-applies the exact
  // same ownership predicate as ①, so this instruction is safe standing
  // entirely on its own.
  const scopedSessionIds = db
    .select({ id: measurementSessions.id })
    .from(measurementSessions)
    .where(ownedByCaller);

  const deleteStaleMeasurements =
    presentKinds.length === MEASUREMENT_CATALOG.length
      ? null
      : db
          .delete(measurements)
          .where(
            and(
              notInArray(measurements.kind, presentKinds),
              inArray(measurements.sessionId, scopedSessionIds),
            ),
          );

  // ③ one multi-row insert, upserting on the (session_id, kind) unique
  // constraint (ADR 004). `sql`excluded.value`` — NEVER a literal: this
  // insert can carry several rows in the same call, and a literal
  // `set: { value: <one value> }` would overwrite every conflicting row
  // with that same value (R3, C8 — correcting the weight would also
  // rewrite the waist).
  const upsertMeasurements = db
    .insert(measurements)
    .values(
      presentKinds.map((kind) => ({
        id: crypto.randomUUID(),
        sessionId,
        kind,
        value: values[kind] as number,
      })),
    )
    .onConflictDoUpdate({
      target: [measurements.sessionId, measurements.kind],
      set: { value: sql`excluded.value` },
    });

  return { updateSession, deleteStaleMeasurements, upsertMeasurements };
}

/**
 * s09 plan task 4: the deletion pair, each instruction sealed with the
 * same ownership scope as buildUpdateSessionStatements — R7: the FK IS
 * declared `onDelete: "cascade"` (s03), and this does not lean on it
 * anyway. If the cascade does its job, this instruction is inert; if it
 * doesn't, this is what actually deletes the measurements.
 */
export function buildDeleteSessionStatements(
  db: AppDatabase,
  { sessionId, userId }: { sessionId: string; userId: string },
) {
  const ownedByCaller = and(
    eq(measurementSessions.id, sessionId),
    eq(measurementSessions.userId, userId),
  );

  const scopedSessionIds = db
    .select({ id: measurementSessions.id })
    .from(measurementSessions)
    .where(ownedByCaller);

  // ① the measurements, before the session (never after — a session
  // deleted first would make this subquery resolve to nothing).
  const deleteMeasurements = db
    .delete(measurements)
    .where(inArray(measurements.sessionId, scopedSessionIds));

  // ② the session itself, with `returning` — the sole "not found or not
  // yours" signal the executor needs (R6, R7).
  const deleteSession = db
    .delete(measurementSessions)
    .where(ownedByCaller)
    .returning({ id: measurementSessions.id });

  return { deleteMeasurements, deleteSession };
}

/**
 * Executor: takes the concrete NeonHttpDatabase (batch() only exists
 * there, R8) and runs the three-instruction update as one HTTP
 * transaction. The empty-values guard runs BEFORE any statement is
 * built — R5, R9's corrected reasoning: an unguarded empty `values`
 * would make the stale-measurements delete's `notInArray(kind, [])`
 * predicate `sql`true``, deleting every measurement on the session. This
 * is the layer's OWN guard, not a repeat of the route handler's Zod
 * validation.
 */
export async function updateSessionForUser(
  db: NeonHttpDatabase,
  params: {
    sessionId: string;
    userId: string;
    measuredOn: string;
    values: Partial<Record<MeasurementKind, number>>;
  },
): Promise<{ found: boolean }> {
  if (Object.keys(params.values).length === 0) {
    throw new Error(
      "updateSessionForUser: refuses an empty `values` payload before building any statement (R5) — the caller must guarantee at least one measurement.",
    );
  }

  const { updateSession, deleteStaleMeasurements, upsertMeasurements } =
    buildUpdateSessionStatements(db, params);

  const [updateResult] = deleteStaleMeasurements
    ? await db.batch([updateSession, deleteStaleMeasurements, upsertMeasurements])
    : await db.batch([updateSession, upsertMeasurements]);

  return { found: updateResult.length > 0 };
}

/**
 * Executor: same driver requirement as updateSessionForUser. The empty
 * `returning` on the session delete is the only "not found or not
 * yours" signal — never an exception (R6).
 */
export async function deleteSessionForUser(
  db: NeonHttpDatabase,
  params: { sessionId: string; userId: string },
): Promise<{ found: boolean }> {
  const { deleteMeasurements, deleteSession } = buildDeleteSessionStatements(
    db,
    params,
  );
  const [, deleteResult] = await db.batch([deleteMeasurements, deleteSession]);

  return { found: deleteResult.length > 0 };
}
