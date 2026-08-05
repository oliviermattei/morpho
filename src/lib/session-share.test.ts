// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildSessionShareText } from "./session-share";
import { MEASUREMENT_CATALOG } from "./measurements";

describe("buildSessionShareText — one measurement per line (ADR 021)", () => {
  it("opens on the session's date, then one line per recorded measurement", () => {
    const text = buildSessionShareText(
      {
        measuredOn: "2026-08-02",
        measurements: [
          { kind: "weight_kg", value: 82.4 },
          { kind: "shoulders_cm", value: 118 },
          { kind: "body_fat_pct", value: 18.5 },
        ],
      },
      null,
    );

    expect(text.split("\n")).toEqual([
      "Mesures du dimanche 2 août 2026",
      "Poids : 82,4 kg",
      "Épaules : 118 cm",
      // The non-breaking space before % comes from formatMeasurementValue
      // (design-system.md §Format numérique) — this test spells it out
      // rather than typing a space that looks the same.
      "Masse grasse : 18,5 %",
    ]);
  });

  // vide ≠ zéro (ADR 004), all the way out to the shared text: a kind
  // with no row produces no line, never "Biceps : 0 cm".
  it("emits no line at all for a measurement that was not recorded", () => {
    const text = buildSessionShareText(
      { measuredOn: "2026-08-02", measurements: [{ kind: "weight_kg", value: 82.4 }] },
      null,
    );

    expect(text.split("\n")).toHaveLength(2);
    expect(text).not.toContain("Biceps");
    expect(text).not.toMatch(/ 0 cm/);
    expect(text).not.toContain("—");
  });

  // The display order, not the order the rows happen to arrive in — the
  // catalog's own, the one /saisie and the charts selector already use.
  it("orders the lines by the catalog, whatever order the rows arrive in", () => {
    const text = buildSessionShareText(
      {
        measuredOn: "2026-08-02",
        measurements: [
          { kind: "muscle_pct", value: 41 },
          { kind: "waist_cm", value: 88 },
          { kind: "weight_kg", value: 82.4 },
        ],
      },
      null,
    );

    const labels = text
      .split("\n")
      .slice(1)
      .map((line) => line.split(" : ")[0]);
    const catalogOrder = MEASUREMENT_CATALOG.map((entry) => entry.label);
    expect(labels).toEqual(
      catalogOrder.filter((label) => labels.includes(label)),
    );
  });
});

describe("buildSessionShareText — the IMC line", () => {
  const weighIn = {
    measuredOn: "2026-08-02",
    measurements: [{ kind: "weight_kg" as const, value: 72.4 }],
  };

  it("adds it last, once a height is known", () => {
    const text = buildSessionShareText(weighIn, 175);
    expect(text.split("\n").at(-1)).toBe("IMC : 23,6");
  });

  it("omits it entirely when the height is unknown", () => {
    expect(buildSessionShareText(weighIn, null)).not.toContain("IMC");
  });

  it("omits it on a session that carries no weight, height or not", () => {
    const text = buildSessionShareText(
      { measuredOn: "2026-07-05", measurements: [{ kind: "biceps_cm", value: 34 }] },
      175,
    );

    expect(text).not.toContain("IMC");
    expect(text).not.toContain("NaN");
  });

  // Criterion 5 of s04, carried into the shared text: the IMC is derived
  // on read, so a corrected height changes what past sessions share.
  it("recomputes with the height rather than storing anything", () => {
    expect(buildSessionShareText(weighIn, 175)).not.toBe(
      buildSessionShareText(weighIn, 178),
    );
  });
});

describe("buildSessionShareText — a session with nothing recorded", () => {
  it("is the date line alone, never an empty or a dangling string", () => {
    expect(
      buildSessionShareText({ measuredOn: "2026-08-02", measurements: [] }, 175),
    ).toBe("Mesures du dimanche 2 août 2026");
  });
});
