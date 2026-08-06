// @vitest-environment node
//
// Plan s08 task 3, decision 23: formatTargetGap is the one function s08
// adds — it delegates to src/lib/format-number.ts's formatFrenchNumber,
// never constructing a second Intl.NumberFormat (locked repo-wide by
// src/lib/source-scans.test.ts's existing scan, which already covers
// this file without modification). Values here are already-rounded
// (decision 4) — formatTargetGap never rounds a second time.
import { describe, expect, it } from "vitest";
import {
  formatTargetGap,
  isTargetReached,
  targetWeightInputSchema,
  weightChartDomain,
  weightGapKg,
} from "./target-weight";

describe("formatTargetGap", () => {
  it("formats a positive gap with an explicit +", () => {
    expect(formatTargetGap(2.4)).toBe("+2,4 kg");
  });

  it("formats a negative gap", () => {
    expect(formatTargetGap(-0.9)).toBe("-0,9 kg");
  });

  it("formats a larger negative gap", () => {
    expect(formatTargetGap(-2.4)).toBe("-2,4 kg");
  });

  it("formats a zero gap with no sign, one decimal — never a bare '0 kg'", () => {
    expect(formatTargetGap(0)).toBe("0,0 kg");
  });

  // Named trap (decision 4, decision 9): plain Intl formatting renders
  // "-0" as "-0,0" — exactly the "negative gap presented as a setback"
  // criterion 6 forbids on an exactly-reached target.
  it("formats a negative zero (-0) as '0,0 kg', never '-0,0 kg'", () => {
    expect(formatTargetGap(-0)).toBe("0,0 kg");
  });
});

// Plan s08 task 4, decision 4: a single rounding, upstream, on the raw
// floating-point difference — never delegated to Intl a second time.
describe("weightGapKg", () => {
  it("rounds away floating-point noise (74.1 - 72 is 2.0999999999999943 in JS)", () => {
    expect(weightGapKg(74.1, 72)).toBe(2.1);
  });

  it("returns exactly 0 when the last weight equals the target", () => {
    expect(weightGapKg(70, 70)).toBe(0);
  });

  // Decision 4's named case: a raw gap of -0.04 rounds to -0 (a real JS
  // value, distinct from +0 by sign bit but `=== 0`) — the target counts
  // as reached, not "almost".
  it("rounds a near-zero negative gap to -0, still equal to 0", () => {
    const gap = weightGapKg(69.96, 70);
    expect(gap).toBe(-0);
    expect(gap === 0).toBe(true);
  });
});

describe("isTargetReached", () => {
  it("is true for a gap of exactly 0", () => {
    expect(isTargetReached(0)).toBe(true);
  });

  it("is true for a gap of -0 (JS: -0 === 0)", () => {
    expect(isTargetReached(-0)).toBe(true);
  });

  it("is false for any non-zero gap, positive or negative", () => {
    expect(isTargetReached(2.1)).toBe(false);
    expect(isTargetReached(-0.9)).toBe(false);
  });
});

// Plan s08 task 4, decision 20: [floor(min-1), ceil(max+1)] over BOTH
// the series values and the target — the domain must always contain
// the target, or the reference line disappears (trap 1).
describe("weightChartDomain", () => {
  it("returns undefined when there is no target", () => {
    expect(weightChartDomain([70, 72, 74], null)).toBeUndefined();
  });

  it("returns undefined when there are no values at all, even with a target", () => {
    expect(weightChartDomain([], 70)).toBeUndefined();
  });

  // The floor is zero on every chart in the app, so a target under the
  // measured range needs no widening — it is already inside.
  it("always floors the domain at zero, whatever the values", () => {
    expect(weightChartDomain([70, 72, 74], 50)![0]).toBe(0);
    expect(weightChartDomain([300, 310], 305)![0]).toBe(0);
    expect(weightChartDomain([20.5], 20)![0]).toBe(0);
  });

  it("raises the ceiling to clear a target far ABOVE every measurement", () => {
    expect(weightChartDomain([70, 72, 74], 100)).toEqual([0, 101]);
  });

  it("keeps a 1kg margin above the highest value when the target sits inside the range", () => {
    expect(weightChartDomain([70, 72, 74], 71)).toEqual([0, 75]);
  });

  it("handles a target exactly equal to the minimum measurement", () => {
    expect(weightChartDomain([70, 72, 74], 70)).toEqual([0, 75]);
  });

  it("handles a target exactly equal to the maximum measurement", () => {
    expect(weightChartDomain([70, 72, 74], 74)).toEqual([0, 75]);
  });

  it("handles a single-point series", () => {
    expect(weightChartDomain([74], 72)).toEqual([0, 75]);
  });

  it("the returned domain always contains both the target and every value", () => {
    const values = [68.5, 71.2, 74.9];
    const target = 90;
    const [lo, hi] = weightChartDomain(values, target)!;

    expect(lo).toBeLessThanOrEqual(Math.min(...values, target));
    expect(hi).toBeGreaterThanOrEqual(Math.max(...values, target));
  });
});

// Plan s08 task 5, trap 11: never z.coerce.number() on the raw string —
// it silently turns "" into 0 (research §5's repo-wide trap). This
// schema goes through src/lib/measurements.ts's parseMeasurementInput
// (s03) instead, the same module the measurement fields already use,
// branching on its three explicit statuses.
describe("targetWeightInputSchema", () => {
  it("parses an emptied field to null — the removal signal, never 0", () => {
    const result = targetWeightInputSchema.safeParse("");
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it("parses a whitespace-only field to null", () => {
    const result = targetWeightInputSchema.safeParse("   ");
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it("accepts a French comma decimal", () => {
    const result = targetWeightInputSchema.safeParse("70,5");
    expect(result.success).toBe(true);
    expect(result.data).toBe(70.5);
  });

  it("accepts a dot decimal", () => {
    const result = targetWeightInputSchema.safeParse("70.5");
    expect(result.success).toBe(true);
    expect(result.data).toBe(70.5);
  });

  it("rounds to one decimal, half away from zero (parseMeasurementInput's own rule)", () => {
    const result = targetWeightInputSchema.safeParse("70,55");
    expect(result.success).toBe(true);
    expect(result.data).toBe(70.6);
  });

  it("rejects an out-of-range value below the minimum, with a message naming both bounds", () => {
    const result = targetWeightInputSchema.safeParse("0");
    expect(result.success).toBe(false);
    const message = result.success ? "" : result.error.issues[0]?.message;
    expect(message).toContain("20");
    expect(message).toContain("400");
  });

  it("rejects an out-of-range value above the maximum, with a message naming both bounds", () => {
    const result = targetWeightInputSchema.safeParse("999");
    expect(result.success).toBe(false);
    const message = result.success ? "" : result.error.issues[0]?.message;
    expect(message).toContain("20");
    expect(message).toContain("400");
  });

  it("rejects an unparseable value", () => {
    const result = targetWeightInputSchema.safeParse("abc");
    expect(result.success).toBe(false);
  });
});
