import { z } from "zod";
import { formatFrenchNumber } from "./format-number";
import { MEASUREMENT_CATALOG_BY_KIND, parseMeasurementInput } from "./measurements";

/**
 * The one new formatting function s08 adds (plan decision 23) — it
 * delegates to src/lib/format-number.ts's formatFrenchNumber, the
 * repo's single number-formatter construction site (locked by
 * src/lib/source-scans.test.ts's existing scan, which covers this file
 * automatically). No second module, no second formatter construction.
 *
 * `gapKg` must already be rounded to one decimal (decision 4 —
 * weightGapKg, task 4 — does that once, upstream): this function only
 * ever formats, it never rounds. `signDisplay: 'exceptZero'` is what
 * turns a `-0` (the JS Math.round artifact on a half-negative gap) into
 * "0,0 kg" instead of "-0,0 kg" — the exact "negative gap read as a
 * setback" criterion 6 forbids on a target reached exactly.
 */
export function formatTargetGap(gapKg: number): string {
  const formatted = formatFrenchNumber(gapKg, {
    signDisplay: "exceptZero",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${formatted} kg`;
}

// s03's own rounding rule (src/lib/measurements.ts's parseMeasurementInput,
// src/lib/height.ts's heightInputSchema): Math.round(v * 10) / 10, at the
// server boundary. Neither of those modules exports this as a shared
// function to import — each inlines it — so this is the same one-line
// formula reproduced a third time, not a divergent one, and not the
// "new formatting module" decision 23 forbids (that decision is about
// Intl.NumberFormat construction sites, which this never touches).
function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Plan task 4, decision 4: the ONLY rounding step for the target gap —
 * every other surface (the displayed text, isTargetReached) consumes
 * this already-rounded value, never the raw floating-point difference.
 * Rounding once here, instead of once in the formatter and once again
 * implicitly wherever "reached" is decided, is what keeps the displayed
 * gap and the "Cible atteinte" note from ever disagreeing (the plan's
 * own measured bug: rounding twice can pick different tie-breaks).
 */
export function weightGapKg(lastWeightKg: number, targetKg: number): number {
  return roundToTenth(lastWeightKg - targetKg);
}

/**
 * `-0 === 0` is `true` in JavaScript, so a gap that rounded to negative
 * zero (weightGapKg(69.96, 70) — decision 4's named case) still counts
 * as reached here, with no special-casing needed.
 */
export function isTargetReached(gapKg: number): boolean {
  return gapKg === 0;
}

/**
 * Plan task 4, decision 20 (trap 1): the Y axis domain the weight chart
 * uses WHEN a target is set — s07's own `['auto','auto']` default stays
 * untouched otherwise (undefined here means "don't override"). Spans
 * both the series values and the target with a flat 1kg margin, floored/
 * ceiled to an integer: without the target folded into min/max, a
 * reference line's default overflow behaviour discards it entirely the
 * moment it sits outside the measured range — the normal case at the
 * start of an objective, not an edge case to shrug off.
 */
export function weightChartDomain(
  values: readonly number[],
  targetKg: number | null,
): [number, number] | undefined {
  if (targetKg === null || values.length === 0) {
    return undefined;
  }
  const withTarget = [...values, targetKg];
  const min = Math.min(...withTarget);
  const max = Math.max(...withTarget);
  return [Math.floor(min - 1), Math.ceil(max + 1)];
}

const { min: TARGET_WEIGHT_MIN_KG, max: TARGET_WEIGHT_MAX_KG } =
  MEASUREMENT_CATALOG_BY_KIND.weight_kg;

// Exported so the route handler can reuse the exact same message for a
// malformed payload (same motif as src/lib/height.ts's
// HEIGHT_FORMAT_ERROR).
export const TARGET_WEIGHT_FORMAT_ERROR = "Indiquez un nombre, par exemple 70.";
const TARGET_WEIGHT_RANGE_ERROR = `Indiquez un poids cible entre ${TARGET_WEIGHT_MIN_KG} et ${TARGET_WEIGHT_MAX_KG} kg.`;

/**
 * Plan task 5, decision 8, trap 11: the field's single entry point.
 * Never `z.coerce.number()` on the raw string — it silently turns ""
 * into 0 (the repo-wide vide ≠ zéro trap). Goes through src/lib/
 * measurements.ts's parseMeasurementInput instead — the same module
 * the ten measurement fields already use — and branches explicitly on
 * its three statuses, exactly like src/lib/height.ts's
 * heightInputSchema does for the reference height.
 *
 * The range comes from MEASUREMENT_CATALOG_BY_KIND.weight_kg (decision
 * 8) — declared once, in src/lib/measurements.ts, never a second copy
 * of "20 and 400" hand-typed here.
 */
export const targetWeightInputSchema = z
  .string()
  .transform((raw, ctx): number | null => {
    const parsed = parseMeasurementInput(raw);

    if (parsed.status === "empty") {
      return null;
    }
    if (parsed.status === "invalid") {
      ctx.addIssue({ code: "custom", message: TARGET_WEIGHT_FORMAT_ERROR });
      return z.NEVER;
    }
    if (
      parsed.value < TARGET_WEIGHT_MIN_KG ||
      parsed.value > TARGET_WEIGHT_MAX_KG
    ) {
      ctx.addIssue({ code: "custom", message: TARGET_WEIGHT_RANGE_ERROR });
      return z.NEVER;
    }
    return parsed.value;
  });
