import type { MeasurementBoundary } from "./db/latest-measurements";

/**
 * ADR 020: the home header's second line — "J+42 · perte en cours".
 *
 * The phase is derived from the two weight boundaries the screen has
 * already read, as NUMBERS. It is deliberately not read back off the
 * formatted delta string the view carries: that string is localised
 * ("−3,2 kg", with U+2212, not a hyphen), and sniffing its first
 * character for a sign would be a formatting detail masquerading as
 * business logic — one Intl change away from silently reporting a loss
 * as a gain.
 */
export type TransformationPhase =
  | "no-measurement"
  | "first-measurement"
  | "losing"
  | "gaining"
  | "stable";

export const PHASE_LABELS: Record<TransformationPhase, string> = {
  "no-measurement": "aucune mesure",
  "first-measurement": "1re mesure",
  losing: "perte en cours",
  gaining: "prise en cours",
  stable: "poids stable",
};

/**
 * The threshold is the storage precision, not a judgement call:
 * measurements.value is numeric(5,1), so anything under 0.1 kg cannot
 * be a real recorded difference — it can only be a rounding artefact.
 * Calling that "perte en cours" would put a trend on the header that no
 * pair of stored values actually supports.
 */
const STABLE_THRESHOLD_KG = 0.1;

export function deriveTransformationPhase(
  firstWeight: MeasurementBoundary | undefined,
  lastWeight: MeasurementBoundary | undefined,
): TransformationPhase {
  if (!lastWeight) {
    return "no-measurement";
  }
  if (!firstWeight || firstWeight.measurementId === lastWeight.measurementId) {
    // Same identity check as buildMeasurementEntry's "single" state
    // (src/lib/body-map-view.ts, decision 11): two distinct rows holding
    // the same value are a comparison with a zero delta, not a single
    // measurement.
    return "first-measurement";
  }
  // Rounded to the storage precision BEFORE the threshold check, not
  // after. 82.5 - 82.4 is 0.09999999999999432 in IEEE 754, which slips
  // under a raw 0.1 comparison and reports a real 100 g loss as "poids
  // stable" — caught by test, not by inspection.
  const delta = Math.round((lastWeight.value - firstWeight.value) * 10) / 10;
  if (Math.abs(delta) < STABLE_THRESHOLD_KG) {
    return "stable";
  }
  return delta < 0 ? "losing" : "gaining";
}
