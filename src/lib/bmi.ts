import { formatFrenchNumber } from "./format-number";

/**
 * BMI is derived on read, never stored (story s04's structural lock,
 * criterion 5) — this is the single place that divides weight by height²,
 * so every surface that shows a BMI (BmiCard, the history suffix) stays
 * in sync by construction rather than by discipline (research trap 6).
 *
 * Returns the raw, unrounded value — R8: rounding happens exactly once,
 * in formatBmi, never here and never twice.
 *
 * `null` whenever either input is missing, and also when heightCm is 0
 * (defensive: heightInputSchema's 80–260cm range already forbids 0 in
 * practice, but this function must never hand back Infinity or NaN to a
 * caller that only checked for null).
 */
export function computeBmi(
  weightKg: number | null,
  heightCm: number | null,
): number | null {
  if (weightKg === null || heightCm === null || heightCm === 0) {
    return null;
  }
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

/**
 * Formats an already-computed BMI for display — French comma, one
 * decimal, no trailing zero. Callers branch on computeBmi's null case
 * themselves (BmiCard's two states, the history suffix's per-session
 * check): this function only ever receives a real number.
 *
 * No classification, no threshold, no medical label lives in this
 * module — morpho shows a number (PRD, story s04's constraint).
 */
export function formatBmi(bmi: number): string {
  return formatFrenchNumber(bmi);
}
