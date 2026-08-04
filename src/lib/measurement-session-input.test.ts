import { describe, expect, it } from "vitest";
import { parseMeasurementSessionInput } from "./measurement-session-input";

const TODAY = new Date("2026-08-02T12:00:00Z");

describe("parseMeasurementSessionInput — the entirely empty form (criterion 4)", () => {
  it("rejects with a form-level message and no field errors when every measurement is empty", () => {
    const result = parseMeasurementSessionInput(
      { measuredOn: "2026-08-02" },
      TODAY,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.formErrors).toEqual([
      "Renseignez au moins une mesure avant d'enregistrer.",
    ]);
    expect(result.fieldErrors).toEqual({});
  });

  it("also rejects when every measurement field is present but blank", () => {
    const result = parseMeasurementSessionInput(
      {
        measuredOn: "2026-08-02",
        weight_kg: "",
        waist_cm: "   ",
      },
      TODAY,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.formErrors).toEqual([
      "Renseignez au moins une mesure avant d'enregistrer.",
    ]);
  });
});

describe("parseMeasurementSessionInput — partial submission (criterion 3)", () => {
  it("accepts weight alone and returns exactly one measurement", () => {
    const result = parseMeasurementSessionInput(
      { measuredOn: "2026-08-02", weight_kg: "82,4" },
      TODAY,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.measuredOn).toBe("2026-08-02");
    expect(result.value.measurements).toEqual([
      { kind: "weight_kg", value: 82.4 },
    ]);
  });

  it("drops an empty field silently — no measurement, no zero — while keeping a valid sibling field", () => {
    const result = parseMeasurementSessionInput(
      { measuredOn: "2026-08-02", weight_kg: "", waist_cm: "80" },
      TODAY,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.measurements).toEqual([
      { kind: "waist_cm", value: 80 },
    ]);
  });
});

describe("parseMeasurementSessionInput — physiological ranges (criterion 5)", () => {
  it("rejects a waist measurement of 500cm with a field error, even though the client could have let it through", () => {
    const result = parseMeasurementSessionInput(
      { measuredOn: "2026-08-02", waist_cm: "500" },
      TODAY,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.waist_cm).toBeDefined();
  });

  it("rejects a body fat percentage over 100", () => {
    const result = parseMeasurementSessionInput(
      { measuredOn: "2026-08-02", body_fat_pct: "101" },
      TODAY,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.body_fat_pct).toBeDefined();
  });

  it("rejects a negative weight", () => {
    const result = parseMeasurementSessionInput(
      { measuredOn: "2026-08-02", weight_kg: "-5" },
      TODAY,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.weight_kg).toBeDefined();
  });
});

describe("parseMeasurementSessionInput — the date window (plan decision 9)", () => {
  it("rejects a date that isn't ISO-formatted", () => {
    const result = parseMeasurementSessionInput(
      { measuredOn: "02/08/2026", weight_kg: "80" },
      TODAY,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.measuredOn).toBeDefined();
  });

  it("rejects a date two UTC days ahead of now", () => {
    const result = parseMeasurementSessionInput(
      { measuredOn: "2026-08-04", weight_kg: "80" },
      TODAY,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.measuredOn).toBeDefined();
  });

  it("accepts a date exactly one UTC day ahead of now", () => {
    const result = parseMeasurementSessionInput(
      { measuredOn: "2026-08-03", weight_kg: "80" },
      TODAY,
    );

    expect(result.ok).toBe(true);
  });

  it("rejects a date before the year 2000", () => {
    const result = parseMeasurementSessionInput(
      { measuredOn: "1999-12-31", weight_kg: "80" },
      TODAY,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.measuredOn).toBeDefined();
  });
});
