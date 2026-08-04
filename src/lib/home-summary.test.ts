// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PHASE_LABELS, deriveTransformationPhase } from "./home-summary";

const boundary = (measurementId: string, value: number) => ({
  measurementId,
  value,
});

describe("deriveTransformationPhase", () => {
  it("reports no measurement when nothing has ever been recorded", () => {
    expect(deriveTransformationPhase(undefined, undefined)).toBe(
      "no-measurement",
    );
  });

  // Same identity rule as body-map-view's "single" state: one row is not
  // a comparison, even though `first` and `last` both point at it.
  it("reports a first measurement when both boundaries are the same row", () => {
    const only = boundary("m-1", 85.6);
    expect(deriveTransformationPhase(only, only)).toBe("first-measurement");
  });

  it("reports a loss when the last weight is below the first", () => {
    expect(
      deriveTransformationPhase(boundary("m-1", 85.6), boundary("m-2", 82.4)),
    ).toBe("losing");
  });

  it("reports a gain when the last weight is above the first", () => {
    expect(
      deriveTransformationPhase(boundary("m-1", 82.4), boundary("m-2", 85.6)),
    ).toBe("gaining");
  });

  // The threshold is the storage precision: numeric(5,1) cannot hold a
  // difference smaller than 0.1 kg, so anything under it is a rounding
  // artefact, not a trend to put in the header.
  it("reports stability for two distinct rows holding the same weight", () => {
    expect(
      deriveTransformationPhase(boundary("m-1", 82.4), boundary("m-2", 82.4)),
    ).toBe("stable");
  });

  it("reports a real 0,1 kg move rather than calling it stable", () => {
    expect(
      deriveTransformationPhase(boundary("m-1", 82.5), boundary("m-2", 82.4)),
    ).toBe("losing");
  });
});

describe("PHASE_LABELS", () => {
  it("gives every phase a French label — the header renders it verbatim", () => {
    expect(PHASE_LABELS.losing).toBe("perte en cours");
    expect(Object.values(PHASE_LABELS).every((l) => l.length > 0)).toBe(true);
  });
});
