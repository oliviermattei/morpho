// @vitest-environment node
//
// Plan task 4, R7: the empty string is intercepted before any numeric
// coercion and becomes null (removal), never a fabricated 0 — the
// height-specific variant of the "vide n'est pas zéro" trap ADR 004 names
// for measurements.value.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  heightInputSchema,
} from "./height";

describe("HEIGHT_MIN_CM / HEIGHT_MAX_CM", () => {
  it("declares the physiological range from the design (80–260 cm)", () => {
    expect(HEIGHT_MIN_CM).toBe(80);
    expect(HEIGHT_MAX_CM).toBe(260);
  });
});

describe("heightInputSchema — clearing the field (R7)", () => {
  it('parses "" as null, not an error and not a zero', () => {
    const result = heightInputSchema.safeParse("");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBeNull();
  });

  it('parses "   " (whitespace only) as null too', () => {
    const result = heightInputSchema.safeParse("   ");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBeNull();
  });
});

describe("heightInputSchema — accepted values", () => {
  it('accepts the French comma decimal separator: "175,5" -> 175.5', () => {
    const result = heightInputSchema.safeParse("175,5");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe(175.5);
  });

  it('accepts a plain integer string: "175" -> 175', () => {
    const result = heightInputSchema.safeParse("175");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe(175);
  });

  it("accepts the exact bounds, 80 and 260", () => {
    expect(heightInputSchema.safeParse("80").success).toBe(true);
    expect(heightInputSchema.safeParse("260").success).toBe(true);
  });
});

// Review finding 6: s03 rounds to one decimal at the server boundary,
// before storage (src/lib/measurements.ts's parseMeasurementInput,
// Math.round(v*10)/10) — without the same rule here, "175,55" would
// pass validation unrounded and become "175.6" only once Postgres's
// numeric(4,1) rounds it implicitly at storage, so the user would see
// their own input change after router.refresh() with no rule saying so.
describe("heightInputSchema — rounds to one decimal, same rule as s03 (review finding 6)", () => {
  it('rounds "175,55" to 175.6 before it ever reaches storage', () => {
    const result = heightInputSchema.safeParse("175,55");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe(175.6);
  });

  it('rounds "175,54" down to 175.5', () => {
    const result = heightInputSchema.safeParse("175,54");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe(175.5);
  });

  it("range validation applies to the rounded value, not the raw one", () => {
    // 260.04 rounds to 260.0, still in range.
    expect(heightInputSchema.safeParse("260,04").success).toBe(true);
    // 260.06 rounds to 260.1, out of range.
    const result = heightInputSchema.safeParse("260,06");
    expect(result.success).toBe(false);
  });
});

describe("heightInputSchema — rejected values", () => {
  it('rejects "abc" with a format error', () => {
    const result = heightInputSchema.safeParse("abc");
    expect(result.success).toBe(false);
    expect(result.success || result.error.issues[0]?.message).toBe(
      "Indiquez un nombre, par exemple 175.",
    );
  });

  it('rejects "79" with a range error', () => {
    const result = heightInputSchema.safeParse("79");
    expect(result.success).toBe(false);
    expect(result.success || result.error.issues[0]?.message).toBe(
      "Indiquez une taille entre 80 et 260 cm.",
    );
  });

  it('rejects "261" with a range error', () => {
    const result = heightInputSchema.safeParse("261");
    expect(result.success).toBe(false);
    expect(result.success || result.error.issues[0]?.message).toBe(
      "Indiquez une taille entre 80 et 260 cm.",
    );
  });
});

// Named trap (research §5, plan task 4): z.coerce.number() alone turns an
// empty string into 0 without complaint. heightInputSchema exists so this
// project's height field never reproduces it, however it's composed.
describe("heightInputSchema — non-regression against the z.coerce.number() trap", () => {
  it("z.coerce.number().safeParse('') really does return { success: true, data: 0 } (the trap, reproduced)", () => {
    const result = z.coerce.number().safeParse("");
    expect(result).toEqual({ success: true, data: 0 });
  });

  it("this module's schema never does that: an empty string is null, never 0", () => {
    const result = heightInputSchema.safeParse("");
    expect(result.success && result.data).not.toBe(0);
    expect(result.success && result.data).toBeNull();
  });
});
