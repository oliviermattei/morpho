// @vitest-environment node
//
// Plan task 3: computeBmi is the single source of the BMI calculation
// (research trap 6) — every surface that shows a BMI (BmiCard, the
// history suffix) calls it instead of dividing weight by height² itself,
// which is what makes criterion 5 ("changing the height recomputes past
// sessions") true by construction rather than by discipline.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { computeBmi, formatBmi } from "./bmi";

describe("computeBmi", () => {
  it("divides weight (kg) by height (m) squared", () => {
    // 72.4 / 1.75^2 = 23.640816...
    expect(computeBmi(72.4, 175)).toBeCloseTo(23.640816326530615, 10);
  });

  it("returns null when the height is missing, never a division by a fabricated value", () => {
    expect(computeBmi(72.4, null)).toBeNull();
  });

  it("returns null when the weight is missing", () => {
    expect(computeBmi(null, 175)).toBeNull();
  });

  it("returns null for both missing", () => {
    expect(computeBmi(null, null)).toBeNull();
  });

  it("never produces Infinity for a height of 0", () => {
    const result = computeBmi(72.4, 0);
    expect(result).toBeNull();
    expect(result).not.toBe(Infinity);
  });
});

describe("formatBmi", () => {
  it("formats with the French decimal comma", () => {
    expect(formatBmi(computeBmi(72.4, 175)!)).toBe("23,6");
  });

  // R8: a single rounding rule, at format time — never toFixed(1), never a
  // round baked into computeBmi's own return value.
  it("never shows a trailing zero for a whole BMI", () => {
    expect(formatBmi(24)).toBe("24");
  });

  it("rounds 24.05 to 24,1 (Intl.NumberFormat's halfExpand)", () => {
    expect(formatBmi(24.05)).toBe("24,1");
  });

  it("rounds 24.25 to 24,3", () => {
    expect(formatBmi(24.25)).toBe("24,3");
  });
});

// Non-regression: computeBmi/formatBmi never reproduce the trap the rest
// of the module exists to avoid (research §5, ADR 004's sibling trap).
describe("bmi module — vide is not zéro, structurally", () => {
  it("z.coerce.number() itself turns an empty string into 0 — the trap this module never touches", () => {
    expect(z.coerce.number().safeParse("").data).toBe(0);
  });

  it("computeBmi given an explicit weight of 0 never silently becomes a normal BMI (0 is a real, if absurd, division)", () => {
    // Not a trap this function needs to guard — 0 never reaches it because
    // src/lib/measurements.ts's parseMeasurementInput/height.ts's
    // heightInputSchema both intercept the empty string before any
    // coercion. Documented here as the boundary this module trusts.
    expect(computeBmi(0, 175)).toBe(0);
  });
});
