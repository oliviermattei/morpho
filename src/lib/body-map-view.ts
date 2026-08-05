import type { MeasurementBoundary } from "./db/latest-measurements";
import { computeBmi, formatBmi } from "./bmi";
import { formatFrenchNumber } from "./format-number";
import {
  MEASUREMENT_CATALOG,
  formatMeasurementDelta,
  formatMeasurementValue,
  verdictForDelta,
  type MeasurementKind,
  type MeasurementVerdict,
} from "./measurements";

export type ZoneState = "none" | "single" | "compared";

export interface ViewEntry {
  state: ZoneState;
  valueText: string | null;
  deltaText: string | null;
  verdict: MeasurementVerdict | null;
}

export interface BodyMapView {
  measurements: Partial<Record<MeasurementKind, ViewEntry>>;
  bmi: ViewEntry;
}

type BoundaryMap = Partial<Record<MeasurementKind, MeasurementBoundary>>;

const NONE_ENTRY: ViewEntry = {
  state: "none",
  valueText: null,
  deltaText: null,
  verdict: null,
};

/**
 * Plan s06 task 4, decision 19: `buildBodyMapView` and
 * src/lib/measurements.ts's formatMeasurementDelta are the ONLY two
 * places in the repo allowed to assign a `verdict` — this function never
 * writes its own rule, it only recopies what formatMeasurementDelta
 * returns (measurements) or calls the same shared verdictForDelta (BMI).
 *
 * Pure: no database access, no `db` parameter — first/last/heightCm
 * arrive already read (src/lib/db/body-map.ts).
 */
export function buildBodyMapView(
  first: BoundaryMap,
  last: BoundaryMap,
  heightCm: number | null,
): BodyMapView {
  const measurements: Partial<Record<MeasurementKind, ViewEntry>> = {};

  for (const entry of MEASUREMENT_CATALOG) {
    measurements[entry.kind] = buildMeasurementEntry(
      entry.kind,
      entry.unit,
      first[entry.kind],
      last[entry.kind],
    );
  }

  return { measurements, bmi: buildBmiEntry(first, last, heightCm) };
}

/**
 * Decision 11: "only one measurement ever recorded" is read from
 * identity — first and last are the SAME row (same measurementId) — not
 * from "no first boundary". Two distinct rows with an equal value are
 * still `compared`, with a neutral 0,0 delta, never `single`.
 */
function buildMeasurementEntry(
  kind: MeasurementKind,
  unit: Parameters<typeof formatMeasurementValue>[1],
  firstBoundary: MeasurementBoundary | undefined,
  lastBoundary: MeasurementBoundary | undefined,
): ViewEntry {
  if (!lastBoundary) {
    return NONE_ENTRY;
  }

  const valueText = formatMeasurementValue(lastBoundary.value, unit);

  if (
    !firstBoundary ||
    firstBoundary.measurementId === lastBoundary.measurementId
  ) {
    return { state: "single", valueText, deltaText: null, verdict: null };
  }

  const delta = lastBoundary.value - firstBoundary.value;
  const { text, verdict } = formatMeasurementDelta(kind, delta);
  return { state: "compared", valueText, deltaText: text, verdict };
}

/**
 * The IMC is derived here (computeBmi/formatBmi, s04 — never
 * poids/taille² written a second time) from the SAME weight boundaries
 * every other read in this module already has, at a constant height.
 * It follows the same single colour rule as every measurement (down is
 * favorable, up is adverse, unchanged is neutral) — decision 5's "the
 * IMC is always neutral" existed only because the IMC was absent from
 * the per-kind favorable-direction table, and that table is gone.
 */
function buildBmiEntry(
  first: BoundaryMap,
  last: BoundaryMap,
  heightCm: number | null,
): ViewEntry {
  if (heightCm === null) {
    return NONE_ENTRY;
  }

  const lastWeight = last.weight_kg;
  if (!lastWeight) {
    return NONE_ENTRY;
  }

  const lastBmi = computeBmi(lastWeight.value, heightCm);
  if (lastBmi === null) {
    return NONE_ENTRY;
  }
  const valueText = formatBmi(lastBmi);

  const firstWeight = first.weight_kg;
  if (!firstWeight || firstWeight.measurementId === lastWeight.measurementId) {
    return { state: "single", valueText, deltaText: null, verdict: "neutral" };
  }

  const firstBmi = computeBmi(firstWeight.value, heightCm);
  if (firstBmi === null) {
    return { state: "single", valueText, deltaText: null, verdict: "neutral" };
  }

  const delta = lastBmi - firstBmi;
  const deltaText = formatFrenchNumber(delta, {
    signDisplay: "exceptZero",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return {
    state: "compared",
    valueText,
    deltaText,
    verdict: verdictForDelta(delta),
  };
}
