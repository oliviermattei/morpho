import { asc, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "./index";
import { measurementKind, measurements, measurementSessions } from "./schema";
import { getProfile } from "../profile";
import { computeBmi } from "../bmi";
import { buildSeries, type RawSeriesRow, type SeriesPoint } from "../measurement-series";
import type { MeasurementKind } from "../measurements";

export type BmiSeriesResult =
  | { status: "ok"; series: SeriesPoint[] }
  | { status: "heightMissing" };

export interface AllMeasurementSeries {
  byKind: Record<MeasurementKind, SeriesPoint[]>;
  bmi: BmiSeriesResult;
}

/**
 * The one query this screen needs (plan task 3, R7 — everything loads at
 * mount since the measure selector is client-local state, R6): every
 * measurement row for `userId`, across all 10 kinds, joined to its
 * session's date and creation time. `orderBy` carries R1's chain
 * (measured_on ASC, created_at DESC) — buildSeries (src/lib/
 * measurement-series.ts) still re-derives the same-date tie-break itself
 * as a pure function, this ordering is not the only thing making it
 * correct, just a consistent read.
 *
 * `db` takes AppDatabase (s03 decision 21) so this runs unmodified
 * against PGlite (tests) and Neon (production); `getDb()` is always
 * called by the caller, in the request, never at module scope (s01
 * review finding D — every loader-shaped function in this repo follows
 * this). `userId` has no default and never comes from client input
 * (AGENTS.md) — the caller (src/app/graphes/page.tsx, task 7) passes in
 * `getAuth().getSession()`'s own `data.user.id`.
 */
export async function getAllMeasurementSeries(
  db: AppDatabase,
  userId: string,
): Promise<AllMeasurementSeries> {
  const rows: RawSeriesRow[] = await db
    .select({
      kind: measurements.kind,
      measuredOn: measurementSessions.measuredOn,
      value: measurements.value,
      createdAt: measurementSessions.createdAt,
    })
    .from(measurements)
    .innerJoin(
      measurementSessions,
      eq(measurements.sessionId, measurementSessions.id),
    )
    .where(eq(measurementSessions.userId, userId))
    .orderBy(
      asc(measurementSessions.measuredOn),
      desc(measurementSessions.createdAt),
    );

  const byKind = Object.fromEntries(
    measurementKind.enumValues.map((kind) => [kind, buildSeries(rows, kind)]),
  ) as Record<MeasurementKind, SeriesPoint[]>;

  const profile = await getProfile(db, userId);
  const bmi: BmiSeriesResult =
    profile?.heightCm == null
      ? { status: "heightMissing" }
      : {
          status: "ok",
          // Reuses src/lib/bmi.ts's computeBmi — never a second formula
          // (plan task 3, research trap 6): height is a single value on
          // the profile row, not itself a time series, so each weight
          // point keeps its own `t` and only its `value` is transformed.
          series: byKind.weight_kg.map((point) => ({
            t: point.t,
            value: computeBmi(point.value, profile.heightCm)!,
          })),
        };

  return { byKind, bmi };
}
