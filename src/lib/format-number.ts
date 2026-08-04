/**
 * The single French-number rounding-and-formatting rule in the project
 * (design system §Format numérique): decimal comma, at most one decimal,
 * no superfluous trailing zero (`23,6`, `24`, never `24,0`). Extracted
 * from src/lib/measurements.ts's formatMeasurementValue (plan P2): that
 * function's signature imposes a unit ("kg"/"cm"/"%"), which src/lib/
 * bmi.ts's formatBmi has none of — rather than a second, divergent
 * rounding rule for BMI, this is the one core both delegate to.
 *
 * Intl.NumberFormat's default roundingMode resolves to "halfExpand"
 * (verified against the installed Node runtime, plan decision R8) — the
 * mechanism R8 explicitly settled on, not toFixed(1) (which forces a
 * trailing zero) and not a manual Math.round baked into a caller.
 *
 * Plan s06 task 2: the options bag widens to accept `signDisplay` and
 * `minimumFractionDigits` — what src/lib/measurements.ts's
 * formatMeasurementDelta needs (an explicit "+", and exactly one decimal
 * even on a whole delta, e.g. "-2,0") — still through this single
 * Intl.NumberFormat construction. `new Intl.NumberFormat` must never
 * appear a second time anywhere in the repo (DoD, test strategy scan);
 * every caller, including the delta formatter, goes through this
 * function.
 */
export function formatFrenchNumber(
  value: number,
  options?: Pick<
    Intl.NumberFormatOptions,
    "signDisplay" | "minimumFractionDigits" | "maximumFractionDigits"
  >,
): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
    ...options,
  }).format(value);
}
