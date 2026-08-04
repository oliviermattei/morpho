import { z } from "zod";

/**
 * Physiological range for the reference height (design, §States;
 * confirmed by plan decision R6): wide enough to catch a typo, not an
 * atypical body. Declared here, next to — not inside — s03's
 * measurements.ts catalog: height is not a tracked `kind`, it lives on
 * the profile.
 */
export const HEIGHT_MIN_CM = 80;
export const HEIGHT_MAX_CM = 260;

// Exported so the route handler can reuse the exact same message for a
// malformed payload (absent field, wrong type, unparseable JSON) — a
// distinct failure from "the string didn't parse as a number", but the
// same field-level message rather than a second piece of copy invented
// for a case the real client never reaches (review finding 2).
export const HEIGHT_FORMAT_ERROR = "Indiquez un nombre, par exemple 175.";
const HEIGHT_RANGE_ERROR = "Indiquez une taille entre 80 et 260 cm.";

// Digits, optionally with one fractional group after a dot or a French
// comma — same shape as measurements.ts's NUMERIC_PATTERN, kept separate
// rather than imported: height isn't a measurement kind (plan R6), and
// this module owns its own validation end to end.
const HEIGHT_NUMBER_PATTERN = /^\d+([.,]\d+)?$/;

/**
 * The module's single entry point. R7: an emptied field (after trim)
 * means "remove the height" and becomes `null` here, intercepted before
 * any numeric coercion could touch it — never allowed to fall into
 * z.coerce.number()'s own trap, which turns "" into 0 without complaint
 * (research §5, reproduced as a non-regression test in height.test.ts).
 *
 * A single ZodType (not a union of a literal("") branch and a numeric
 * branch): a top-level z.union() wraps its sub-issues in a generic
 * "Invalid input" invalid_union issue (measured against the installed
 * Zod 4.4.3), which would bury the specific French messages below. This
 * schema raises them directly via ctx.addIssue instead.
 */
export const heightInputSchema = z
  .string()
  .transform((raw, ctx): number | null => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      return null;
    }
    if (!HEIGHT_NUMBER_PATTERN.test(trimmed)) {
      ctx.addIssue({ code: "custom", message: HEIGHT_FORMAT_ERROR });
      return z.NEVER;
    }
    // Review finding 6: rounded here, at the same server boundary s03
    // rounds at (src/lib/measurements.ts's parseMeasurementInput,
    // Math.round(v*10)/10) — before the range check, so a value that
    // only goes out of range once rounded (e.g. "260,06" -> 260.1) is
    // refused here rather than silently rounded past the bound by
    // Postgres's numeric(4,1) at storage time.
    const value = Math.round(Number(trimmed.replace(",", ".")) * 10) / 10;
    if (value < HEIGHT_MIN_CM || value > HEIGHT_MAX_CM) {
      ctx.addIssue({ code: "custom", message: HEIGHT_RANGE_ERROR });
      return z.NEVER;
    }
    return value;
  });
