import { asc, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "./index";
import { measurements, measurementSessions } from "./schema";
import type { MeasurementKind } from "../measurements";

export interface MeasurementBoundary {
  measurementId: string;
  value: number;
}

/**
 * The ONE `selectDistinctOn` expression in the repo (s06 plan task 3),
 * parameterized by direction. ADR canonical-measurement-ordering: `ORDER
 * BY kind, measured_on, created_at, id`, all DESC for "last", all ASC
 * for "first" — s05's own R1 requires s06 to mirror the id tiebreak too,
 * not stop at measured_on/created_at (an untotal order would make the
 * boundary non-reproducible across renders).
 *
 * Exported — not truly "internal" — so src/lib/db/latest-measurements.
 * test.ts can call `.toSQL()` on the query without executing it (plan
 * task 3, "vérifiable par le SQL produit, sans base").
 *
 * `db` takes AppDatabase (s05 decision N5) so this runs unmodified
 * against PGlite (tests) and Neon (production). `userId` has no default
 * and is never read from a client-supplied value — it comes from
 * `auth.getSession()` at the caller (AGENTS.md).
 */
export function boundaryValuesByKindQuery(
  db: AppDatabase,
  userId: string,
  direction: "first" | "last",
) {
  const order: typeof asc = direction === "first" ? asc : desc;

  return db
    .selectDistinctOn([measurements.kind], {
      kind: measurements.kind,
      measurementId: measurements.id,
      value: measurements.value,
    })
    .from(measurements)
    .innerJoin(
      measurementSessions,
      eq(measurements.sessionId, measurementSessions.id),
    )
    .where(eq(measurementSessions.userId, userId))
    .orderBy(
      measurements.kind,
      order(measurementSessions.measuredOn),
      order(measurementSessions.createdAt),
      order(measurementSessions.id),
    );
}

/**
 * The first (direction: "first") or last (direction: "last") recorded
 * value per measurement kind, plus the id of the row it came from — the
 * id is what body-map-view.ts (task 4) uses to tell "only one
 * measurement ever recorded" (first and last share the same
 * measurementId) apart from "two or more, and they happen to be equal"
 * (decision 11).
 *
 * Partial, never a full Record: a kind absent from the result is a kind
 * this user has never recorded (criterion 2, ADR 004) — never a
 * fabricated 0 or null.
 */
export async function getBoundaryValuesByKind(
  db: AppDatabase,
  userId: string,
  direction: "first" | "last",
): Promise<Partial<Record<MeasurementKind, MeasurementBoundary>>> {
  const rows = await boundaryValuesByKindQuery(db, userId, direction);

  const result: Partial<Record<MeasurementKind, MeasurementBoundary>> = {};
  for (const row of rows) {
    result[row.kind] = { measurementId: row.measurementId, value: row.value };
  }
  return result;
}

/**
 * s05 task 1's own function — its contract and its tests are unchanged
 * (s06 plan task 3): this is now a projection of getBoundaryValuesByKind
 * onto the "last" direction, keeping only the value each kind carries.
 */
export async function getLatestValueByKind(
  db: AppDatabase,
  userId: string,
): Promise<Partial<Record<MeasurementKind, number>>> {
  const last = await getBoundaryValuesByKind(db, userId, "last");

  const result: Partial<Record<MeasurementKind, number>> = {};
  for (const kind of Object.keys(last) as MeasurementKind[]) {
    const boundary = last[kind];
    if (boundary) {
      result[kind] = boundary.value;
    }
  }
  return result;
}
