import { z } from "zod";
import type { MeasurementKind } from "./measurements";

/**
 * The shape a raw joined row must have before buildSeries touches it —
 * `measurements × measurement_sessions`, one row per kind actually
 * recorded (ADR 004: no row means no measurement, never a row with a
 * null value). `value` is deliberately typed `unknown`, not `number`:
 * s03 declares the Drizzle column `mode: "number"`, but this function
 * treats that as a claim to verify, not a guarantee to trust (plan P4 —
 * defense in depth against a numeric column read as the driver's raw
 * string, e.g. "72.40").
 */
export interface RawSeriesRow {
  kind: MeasurementKind;
  measuredOn: string;
  value: unknown;
  createdAt: Date;
}

export interface SeriesPoint {
  t: number;
  value: number;
}

/**
 * Distinct from a read/network failure (plan P4/P14): this is a data
 * CONTRACT violation — a numeric column that came back as something
 * other than a finite number. The caller (src/app/graphes/page.tsx,
 * task 7) renders the same generic error state either way, but logs and
 * reasons about the two differently; blaming the network for a schema
 * bug would send the user into an infinite "Réessayer" loop on the same
 * exception.
 */
export class MeasurementSeriesContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeasurementSeriesContractError";
  }
}

const FINITE_VALUE = z.number().finite();

/**
 * Turns raw joined rows into one measurement kind's chart series (plan
 * task 2, the core of criterion 3): points sorted by date ascending,
 * with the day expressed as a UTC epoch (src/components/MeasurementChart.
 * tsx's XAxis reads `t` directly, `scale="time"`) — UTC because
 * measured_on ("2026-01-26") has no time component of its own, and every
 * date formatter downstream (src/lib/date.ts's formatAxisDate/
 * formatFullDate) is pinned to `timeZone: 'UTC'` too; converting in any
 * other zone would shift the two by up to a day west of Greenwich.
 *
 * `rows` is the FULL cross-kind row set (task 3 fetches every kind in
 * one query) — this function does its own `kind` filtering, which is
 * exactly what makes invariant (a) true by construction: a session that
 * never got a row for `kind` (ADR 004) simply has nothing here to filter
 * in, never a fabricated 0 or a `?? 0`.
 *
 * R1 tie-break, re-implemented here (not merely assumed from the SQL
 * ordering task 3's query applies) so this stays true as a pure function
 * regardless of the order `rows` arrives in: two rows sharing a
 * `measuredOn` collapse to one point, the row with the LATER `createdAt`
 * winning — never an average, never two overlapping points on the same
 * date (a design system rule; two points at the same x read as an
 * instantaneous jump that never happened).
 */
export function buildSeries(
  rows: readonly RawSeriesRow[],
  kind: MeasurementKind,
): SeriesPoint[] {
  const winnerByDate = new Map<string, RawSeriesRow>();

  for (const row of rows) {
    if (row.kind !== kind) continue;

    const current = winnerByDate.get(row.measuredOn);
    if (!current || row.createdAt.getTime() >= current.createdAt.getTime()) {
      winnerByDate.set(row.measuredOn, row);
    }
  }

  const points = Array.from(winnerByDate.entries()).map(
    ([measuredOn, row]): SeriesPoint => {
      const parsed = FINITE_VALUE.safeParse(row.value);
      if (!parsed.success) {
        throw new MeasurementSeriesContractError(
          `${kind} on ${measuredOn}: expected a finite number, received ${typeof row.value} (${JSON.stringify(row.value)})`,
        );
      }
      return { t: isoDateToUtcEpoch(measuredOn), value: parsed.data };
    },
  );

  points.sort((a, b) => a.t - b.t);
  return points;
}

function isoDateToUtcEpoch(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!);
}
