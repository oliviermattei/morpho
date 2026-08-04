import { and, asc, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "./db";
import { measurements, measurementSessions } from "./db/schema";
import type { MeasurementKind } from "./measurements";

export interface MeasurementSessionSummary {
  id: string;
  measuredOn: string;
  measurements: { kind: MeasurementKind; value: number }[];
}

export interface LatestWeighIn {
  weightKg: number;
  measuredOn: string;
  sessionsWithWeightCount: number;
}

/**
 * Reads one user's measurement sessions, most recent first
 * (measured_on DESC, created_at DESC — plan decision 14: two sessions can
 * share a measured_on, so the tiebreak on created_at is what keeps the
 * order deterministic), each carrying only the measurements actually
 * recorded for it.
 *
 * `userId` is required, with no default — the type this function takes
 * for `db` (plan decision 21) is what lets it run unmodified against both
 * PGlite (tests) and Neon (production) without a cast.
 */
export async function listMeasurementSessions(
  db: AppDatabase,
  userId: string,
): Promise<MeasurementSessionSummary[]> {
  const rows = await db
    .select({
      sessionId: measurementSessions.id,
      measuredOn: measurementSessions.measuredOn,
      kind: measurements.kind,
      value: measurements.value,
    })
    .from(measurementSessions)
    .leftJoin(
      measurements,
      eq(measurements.sessionId, measurementSessions.id),
    )
    .where(eq(measurementSessions.userId, userId))
    .orderBy(
      desc(measurementSessions.measuredOn),
      desc(measurementSessions.createdAt),
      // Postgres sorts an enum by its declared ordinal position, not
      // alphabetically — this reuses measurement_kind's declared order
      // (src/lib/db/schema.ts) to keep a session's measurements in the
      // same order the design's form and history mockups show them,
      // regardless of insertion order.
      asc(measurements.kind),
    );

  const sessionsById = new Map<string, MeasurementSessionSummary>();
  const orderedIds: string[] = [];

  for (const row of rows) {
    let session = sessionsById.get(row.sessionId);
    if (!session) {
      session = {
        id: row.sessionId,
        measuredOn: row.measuredOn,
        measurements: [],
      };
      sessionsById.set(row.sessionId, session);
      orderedIds.push(row.sessionId);
    }
    if (row.kind !== null && row.value !== null) {
      session.measurements.push({ kind: row.kind, value: row.value });
    }
  }

  return orderedIds.map((id) => {
    const session = sessionsById.get(id);
    if (!session) {
      throw new Error(`Unreachable: session ${id} missing from its own map`);
    }
    return session;
  });
}

/**
 * The data BmiCard's value state needs (plan task 6): the most recent
 * weight, the date it was recorded on, and how many of the user's
 * sessions carry a weight at all ("Recalculé sur vos N sessions.").
 *
 * Debt acknowledged here, in code, not just in the plan: this is a
 * special case of "last known value per measurement kind" that s05's
 * getLatestValueByKind (docs/plans/s05-quick-entry-prefill.md, task 1,
 * a selectDistinctOn query) replaces outright — not a discovery to make
 * in s05, a debt already written down.
 */
export async function getLatestWeighIn(
  db: AppDatabase,
  userId: string,
): Promise<LatestWeighIn | null> {
  const rows = await db
    .select({
      measuredOn: measurementSessions.measuredOn,
      value: measurements.value,
    })
    .from(measurements)
    .innerJoin(
      measurementSessions,
      eq(measurements.sessionId, measurementSessions.id),
    )
    .where(
      and(
        eq(measurementSessions.userId, userId),
        eq(measurements.kind, "weight_kg"),
      ),
    )
    .orderBy(
      desc(measurementSessions.measuredOn),
      desc(measurementSessions.createdAt),
    );

  const latest = rows[0];
  if (!latest) {
    return null;
  }

  return {
    weightKg: latest.value,
    measuredOn: latest.measuredOn,
    sessionsWithWeightCount: rows.length,
  };
}
