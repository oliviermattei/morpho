// @vitest-environment node
//
// Pure domain function — no database, no mock (plan s06 task 4). This is
// where the story's cheapest-to-write, most-valuable tests live: the
// three zone states, the "single measurement, delta suppressed even
// though it looks compared" trap (decision 11), and the case that locks
// the verdict/text agreement at the view-model level, not just inside
// formatMeasurementDelta.
import { describe, expect, it } from "vitest";
import { buildBodyMapView } from "./body-map-view";

describe("buildBodyMapView — zone states (criteria 4, 5, 6)", () => {
  it("state 'none' for a kind with no boundary at all — no value, no delta, no verdict", () => {
    const view = buildBodyMapView({}, {}, null);

    expect(view.measurements.waist_cm).toEqual({
      state: "none",
      valueText: null,
      deltaText: null,
      verdict: null,
    });
  });

  it("state 'single' when first and last share the same measurementId — one measurement, nothing to compare", () => {
    const boundary = { measurementId: "m-1", value: 96 };
    const view = buildBodyMapView(
      { waist_cm: boundary },
      { waist_cm: boundary },
      null,
    );

    expect(view.measurements.waist_cm).toEqual({
      state: "single",
      valueText: "96 cm",
      deltaText: null,
      verdict: null,
    });
  });

  it("state 'compared' with a favorable verdict when two distinct measurements exist", () => {
    const view = buildBodyMapView(
      { waist_cm: { measurementId: "m-first", value: 96 } },
      { waist_cm: { measurementId: "m-last", value: 88.6 } },
      null,
    );

    expect(view.measurements.waist_cm).toEqual({
      state: "compared",
      valueText: "88,6 cm",
      deltaText: "-7,4 cm",
      verdict: "favorable",
    });
  });

  // Decision 11's named trap: two rows with the SAME value but DIFFERENT
  // measurementId are two real measurements, not one. The zone must
  // still read "compared" with a neutral 0,0 delta, never "single".
  it("two measurements of equal value are 'compared' with a neutral 0,0 delta, never 'single'", () => {
    const view = buildBodyMapView(
      { thigh_cm: { measurementId: "m-first", value: 58.2 } },
      { thigh_cm: { measurementId: "m-last", value: 58.2 } },
      null,
    );

    expect(view.measurements.thigh_cm?.state).toBe("compared");
    expect(view.measurements.thigh_cm?.deltaText).toBe("0,0 cm");
    expect(view.measurements.thigh_cm?.verdict).toBe("neutral");
  });

  // Decision 19's named trap, at the view-model level this time (task 2
  // already locks it inside formatMeasurementDelta on a hand-typed
  // -0.04): a delta computed from two real floats that are each
  // individually clean can leave a tiny residual after subtraction. The
  // rounded text and the verdict must still agree.
  it("a near-zero delta from real float subtraction (86,34 -> 86,30) renders '0,0 cm' AND verdicts neutral", () => {
    const view = buildBodyMapView(
      { waist_cm: { measurementId: "m-first", value: 86.34 } },
      { waist_cm: { measurementId: "m-last", value: 86.3 } },
      null,
    );

    expect(view.measurements.waist_cm?.state).toBe("compared");
    expect(view.measurements.waist_cm?.deltaText).toBe("0,0 cm");
    expect(view.measurements.waist_cm?.verdict).toBe("neutral");
  });

  it("verdict is 'adverse' for a rise on a kind that's favorable when it falls", () => {
    const view = buildBodyMapView(
      { hips_cm: { measurementId: "m-first", value: 100 } },
      { hips_cm: { measurementId: "m-last", value: 100.6 } },
      null,
    );

    expect(view.measurements.hips_cm?.verdict).toBe("adverse");
  });
});

describe("buildBodyMapView — BMI (derived, never stored)", () => {
  it("no height -> the IMC is neither computed nor approximated", () => {
    const view = buildBodyMapView(
      { weight_kg: { measurementId: "m-first", value: 90 } },
      { weight_kg: { measurementId: "m-last", value: 82.4 } },
      null,
    );

    expect(view.bmi).toEqual({
      state: "none",
      valueText: null,
      deltaText: null,
      verdict: null,
    });
  });

  it("no weight ever recorded -> no IMC either, even with a height set", () => {
    const view = buildBodyMapView({}, {}, 178);

    expect(view.bmi).toEqual({
      state: "none",
      valueText: null,
      deltaText: null,
      verdict: null,
    });
  });

  it("height and a single weigh-in -> IMC value, no delta, neutral verdict (never null once a value exists)", () => {
    const boundary = { measurementId: "m-1", value: 82.4 };
    const view = buildBodyMapView(
      { weight_kg: boundary },
      { weight_kg: boundary },
      178,
    );

    expect(view.bmi.state).toBe("single");
    expect(view.bmi.valueText).toBe("26");
    expect(view.bmi.deltaText).toBeNull();
    expect(view.bmi.verdict).toBe("neutral");
  });

  it("height and two weigh-ins -> IMC delta computed at constant height, via two computeBmi calls", () => {
    const view = buildBodyMapView(
      { weight_kg: { measurementId: "m-first", value: 90 } },
      { weight_kg: { measurementId: "m-last", value: 78.4 } },
      178,
    );

    // computeBmi(90, 178) = 28.4..., computeBmi(78.4, 178) = 24.7...
    expect(view.bmi.state).toBe("compared");
    expect(view.bmi.valueText).toBe("24,7");
    expect(view.bmi.deltaText).toBe("-3,7");
    expect(view.bmi.verdict).toBe("favorable");
  });

  // The IMC follows the same single colour rule as every measurement:
  // a rising IMC is adverse, like a rising anything else.
  it("verdicts adverse when the IMC rises", () => {
    const view = buildBodyMapView(
      { weight_kg: { measurementId: "m-first", value: 70 } },
      { weight_kg: { measurementId: "m-last", value: 120 } },
      178,
    );

    expect(view.bmi.verdict).toBe("adverse");
  });
});
