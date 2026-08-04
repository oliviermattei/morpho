// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatFrenchNumber } from "./format-number";

describe("formatFrenchNumber — default behavior (s04, unchanged)", () => {
  it("formats with the French comma and no trailing zero", () => {
    expect(formatFrenchNumber(82.4)).toBe("82,4");
  });

  it("never adds a decimal to a whole number", () => {
    expect(formatFrenchNumber(24)).toBe("24");
  });
});

// Plan s06 task 2: the options bag widens to signDisplay and
// minimumFractionDigits — the one thing formatMeasurementDelta needs
// (an explicit "+" and exactly one decimal, even on a whole delta) —
// without a second Intl.NumberFormat anywhere in the repo.
describe("formatFrenchNumber — widened options (s06 task 2)", () => {
  it("shows an explicit + sign with signDisplay: exceptZero", () => {
    expect(formatFrenchNumber(1.2, { signDisplay: "exceptZero" })).toBe(
      "+1,2",
    );
  });

  it("keeps the sign off an exact zero with signDisplay: exceptZero", () => {
    expect(formatFrenchNumber(0, { signDisplay: "exceptZero" })).toBe("0");
  });

  it("forces exactly one decimal with minimumFractionDigits: 1 — even on a whole number", () => {
    expect(
      formatFrenchNumber(-2, {
        signDisplay: "exceptZero",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    ).toBe("-2,0");
  });

  // The exact trap decision 6 names: -0.04 must format to a signless
  // "0,0", never "-0,0" — Intl's own rounding handles it, verified here
  // rather than trusted from the plan's prose.
  it("rounds -0,04 to a signless 0,0 — never -0,0", () => {
    expect(
      formatFrenchNumber(-0.04, {
        signDisplay: "exceptZero",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    ).toBe("0,0");
  });

  it("still defaults to maximumFractionDigits: 1 with no options passed", () => {
    expect(formatFrenchNumber(82.45)).toBe("82,5");
  });
});
