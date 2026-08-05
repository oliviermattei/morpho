import { describe, expect, it } from "vitest";
import { measurementKind } from "./db/schema";
import {
  MEASUREMENT_CATALOG,
  buildDesiredMeasurements,
  formatMeasurementDelta,
  formatMeasurementValue,
  formatMeasurementValueForInput,
  parseMeasurementInput,
} from "./measurements";

describe("MEASUREMENT_CATALOG", () => {
  // The catalog and the enum no longer share an ORDER — the biceps moved
  // to the end of the mensurations for entry, and a Postgres enum's order
  // is fixed at creation. They must still cover exactly the same kinds:
  // a kind in one and not the other is a real bug (an unwritable field,
  // or a stored value with nowhere to render).
  it("covers exactly the same 10 kinds as the Drizzle enum", () => {
    expect([...MEASUREMENT_CATALOG.map((entry) => entry.kind)].sort()).toEqual(
      [...measurementKind.enumValues].sort(),
    );
  });

  // Locked explicitly, because it is now a decision rather than a
  // consequence of the enum: this is the order the fields appear in on
  // /saisie, in its skeleton and in the charts selector.
  it("declares the entry order — weight, the body top to bottom, biceps last, then the percentages", () => {
    expect(MEASUREMENT_CATALOG.map((entry) => entry.kind)).toEqual([
      "weight_kg",
      "shoulders_cm",
      "chest_cm",
      "waist_cm",
      "hips_cm",
      "thigh_cm",
      "calf_cm",
      "biceps_cm",
      "body_fat_pct",
      "muscle_pct",
    ]);
  });

  it("carries the French label, group, unit and physiological range for weight", () => {
    const weight = MEASUREMENT_CATALOG.find(
      (entry) => entry.kind === "weight_kg",
    );
    expect(weight).toEqual({
      kind: "weight_kg",
      label: "Poids",
      group: "poids",
      unit: "kg",
      min: 20,
      max: 400,
    });
  });

  it("labels the waist 'Taille', the short form the silhouette column needs", () => {
    const waist = MEASUREMENT_CATALOG.find(
      (entry) => entry.kind === "waist_cm",
    );
    expect(waist?.label).toBe("Taille");
  });

  it("carries the correct range for a percentage measurement", () => {
    const bodyFat = MEASUREMENT_CATALOG.find(
      (entry) => entry.kind === "body_fat_pct",
    );
    expect(bodyFat).toEqual({
      kind: "body_fat_pct",
      label: "Masse grasse",
      group: "composition",
      unit: "%",
      min: 1,
      max: 70,
    });
  });
});

// The per-kind favorable direction is gone (user request): one colour
// rule for every measurement — down is favorable, up is adverse,
// unchanged is neutral. See verdictForDelta below.

// Plan s06 task 1: the 7 body-map zones carry their column and vertical
// position (recopied from docs/designs/s06-body-map.md), the 3 off-body
// kinds (weight, the two percentages) carry none — BodyMap.tsx and
// OffBodyCards.tsx branch on this presence, not on a hardcoded kind list.
describe("MEASUREMENT_CATALOG — body map zone geometry (s06 task 1)", () => {
  const TRACKED_ZONES: Record<string, { column: "left" | "right"; top: number }> = {
    shoulders_cm: { column: "left", top: 1 },
    chest_cm: { column: "left", top: 20 },
    hips_cm: { column: "left", top: 43 },
    calf_cm: { column: "left", top: 74 },
    biceps_cm: { column: "right", top: 9 },
    waist_cm: { column: "right", top: 30 },
    thigh_cm: { column: "right", top: 56 },
  };
  const OFF_BODY_KINDS = ["weight_kg", "body_fat_pct", "muscle_pct"];

  it.each(Object.entries(TRACKED_ZONES))(
    "gives %s its column and top percentage",
    (kind, geometry) => {
      const entry = MEASUREMENT_CATALOG.find((candidate) => candidate.kind === kind);
      expect(entry?.bodyMapZone).toMatchObject(geometry);
    },
  );

  it.each(OFF_BODY_KINDS)(
    "gives %s no body map zone — it has no place on the silhouette",
    (kind) => {
      const entry = MEASUREMENT_CATALOG.find((candidate) => candidate.kind === kind);
      expect(entry?.bodyMapZone).toBeUndefined();
    },
  );
});

// Plan task 3, named trap: z.coerce.number().safeParse("") returns
// { success: true, data: 0 } (research §5) — Zod never catches this on its
// own. parseMeasurementInput exists precisely so an empty string is
// classified before any coercion touches it, never silently becoming 0.
describe("parseMeasurementInput", () => {
  it('classifies an empty string as "empty", never as a zero value', () => {
    expect(parseMeasurementInput("")).toEqual({ status: "empty" });
  });

  it('classifies whitespace-only input as "empty"', () => {
    expect(parseMeasurementInput("   ")).toEqual({ status: "empty" });
  });

  it('classifies the literal "0" as a real value of 0 — range rejection is task 4\'s job, not this one\'s', () => {
    expect(parseMeasurementInput("0")).toEqual({
      status: "value",
      value: 0,
    });
  });

  it("accepts a dot decimal separator", () => {
    expect(parseMeasurementInput("72.4")).toEqual({
      status: "value",
      value: 72.4,
    });
  });

  it("accepts the French comma decimal separator", () => {
    expect(parseMeasurementInput("72,4")).toEqual({
      status: "value",
      value: 72.4,
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseMeasurementInput(" 72,4 ")).toEqual({
      status: "value",
      value: 72.4,
    });
  });

  it("rounds to one decimal", () => {
    expect(parseMeasurementInput("82,45")).toEqual({
      status: "value",
      value: 82.5,
    });
  });

  it.each(["abc", "-5", "1e3", "7,2,1"])(
    'classifies "%s" as invalid',
    (raw) => {
      expect(parseMeasurementInput(raw)).toEqual({ status: "invalid" });
    },
  );
});

// Plan s09 task 2, R13, the story's own named trap: "vide" is never
// "zéro". buildDesiredMeasurements is written against
// parseMeasurementInput's discriminated union — a key ABSENT from the
// result means "this measurement must not exist", never a stored 0. The
// four transitions are the story's trap 3, named verbatim: whether a
// kind was recorded before this edit ("présente"/"absente") is a fact
// about the session being edited, not something this pure function
// tracks — it only ever looks at the raw field it's given, which is why
// the four scenarios below collapse to the same two observable
// behaviors, proven on both a kind that would typically already carry a
// value (weight) and one that would typically not (waist).
describe("buildDesiredMeasurements", () => {
  it("présente → modifiée: a field carrying a new valid value is desired at that value", () => {
    const result = buildDesiredMeasurements({ weight_kg: "80,5" });
    expect(result.values).toEqual({ weight_kg: 80.5 });
  });

  it("présente → vidée: a field cleared to an empty string is desired absent, not zero", () => {
    const result = buildDesiredMeasurements({ weight_kg: "" });
    expect(result.values).toEqual({});
    expect(result.values.weight_kg).toBeUndefined();
  });

  it("absente → remplie: a field with no prior value that now carries one is desired at that value", () => {
    const result = buildDesiredMeasurements({ waist_cm: "82,4" });
    expect(result.values).toEqual({ waist_cm: 82.4 });
  });

  it("absente → vide: a field with no prior value that stays empty is desired absent", () => {
    const result = buildDesiredMeasurements({ waist_cm: "" });
    expect(result.values).toEqual({});
  });

  it("a kind entirely missing from rawFields is desired absent, same as an empty string", () => {
    const result = buildDesiredMeasurements({});
    expect(result.values).toEqual({});
  });

  it("never turns an empty string into a stored 0", () => {
    const result = buildDesiredMeasurements({ weight_kg: "", waist_cm: "" });
    expect(Object.values(result.values)).not.toContain(0);
  });

  it("never contains null in its values", () => {
    const result = buildDesiredMeasurements({ weight_kg: "80,5", waist_cm: "" });
    expect(Object.values(result.values).every((value) => value !== null)).toBe(
      true,
    );
  });

  it("classifies an unparseable value as a field error, key absent from values", () => {
    const result = buildDesiredMeasurements({ weight_kg: "abc" });
    expect(result.values).toEqual({});
    expect(result.fieldErrors.weight_kg).toBeDefined();
  });

  it("classifies an out-of-range value as a field error naming the range, key absent from values", () => {
    // weight_kg's declared range is 20-400 (MEASUREMENT_CATALOG).
    const result = buildDesiredMeasurements({ weight_kg: "5" });
    expect(result.values).toEqual({});
    expect(result.fieldErrors.weight_kg).toContain("20");
    expect(result.fieldErrors.weight_kg).toContain("400");
  });

  it("processes several kinds independently in one call", () => {
    const result = buildDesiredMeasurements({
      weight_kg: "80,5",
      waist_cm: "",
      chest_cm: "abc",
      hips_cm: "95",
    });
    expect(result.values).toEqual({ weight_kg: 80.5, hips_cm: 95 });
    expect(result.fieldErrors).toEqual({
      chest_cm: expect.any(String),
    });
  });
});

describe("formatMeasurementValue", () => {
  it("formats a kg value with the French comma and no trailing zero", () => {
    expect(formatMeasurementValue(82.4, "kg")).toBe("82,4 kg");
  });

  it("formats a whole cm value without a decimal", () => {
    expect(formatMeasurementValue(118, "cm")).toBe("118 cm");
  });

  it("formats a whole kg value without a decimal", () => {
    expect(formatMeasurementValue(82, "kg")).toBe("82 kg");
  });

  it("formats a percentage with a non-breaking space before the %", () => {
    expect(formatMeasurementValue(18.5, "%")).toBe("18,5 %");
  });
});

// Plan task 2 (R3, corrected): the domain is the values numeric(5,1) can
// store — at most one decimal — not two-decimal input. On that domain,
// formatMeasurementValueForInput and formatMeasurementValue coincide to
// the digit; the real reason this function exists is that
// formatMeasurementValue glues the unit on ("82,4 kg"), which a
// parseable <input> value must never carry.
describe("formatMeasurementValueForInput", () => {
  it("renders the French comma with no unit and no non-breaking space", () => {
    const rendered = formatMeasurementValueForInput(82.4);

    expect(rendered).toBe("82,4");
    expect(rendered).not.toContain("kg");
    expect(rendered).not.toContain("%");
    expect(rendered).not.toMatch(/\s/);
  });

  it("renders a whole number with no trailing decimal — never '118,0'", () => {
    expect(formatMeasurementValueForInput(118)).toBe("118");
  });

  it("renders a one-decimal percentage value", () => {
    expect(formatMeasurementValueForInput(24.8)).toBe("24,8");
  });

  // Symmetry, written against the discriminated union parseMeasurementInput
  // actually returns (plan R6) — not a bare number. Sample: for every
  // catalog kind, both physiological bounds, an integer, a one-decimal
  // value, and 0.1 above the low bound. Domain = storable values only
  // (at most one decimal, numeric(5,1), s03 decision 6) — two decimals
  // and exponential notation are out of domain and this test says so.
  const STORABLE_SAMPLE: number[] = MEASUREMENT_CATALOG.flatMap((entry) => {
    const mid = Math.floor((entry.min + entry.max) / 2);
    const midDecimal = Math.round((mid + 0.4) * 10) / 10;
    return [entry.min, entry.max, mid, midDecimal, entry.min + 0.1];
  });

  it.each(STORABLE_SAMPLE)(
    "round-trips %s through parseMeasurementInput ∘ formatMeasurementValueForInput",
    (value) => {
      const rounded = Math.round(value * 10) / 10;

      expect(
        parseMeasurementInput(formatMeasurementValueForInput(value)),
      ).toEqual({
        status: "value",
        value: rounded,
      });
    },
  );

  it.each(STORABLE_SAMPLE)(
    "double-rounding is the identity on the storable domain: %s",
    (value) => {
      const rounded = Math.round(value * 10) / 10;

      expect(Math.round(rounded * 10) / 10).toBe(rounded);
    },
  );
});

// formatMeasurementDelta is one of the only two places in the repo
// allowed to assign a verdict — it rounds first, then qualifies the
// ROUNDED result. One rule for every kind, at the user's request: down
// is favorable, up is adverse, unchanged is neutral.
describe("formatMeasurementDelta (s06 task 2)", () => {
  it.each([
    ["waist_cm", -7.4, "favorable"],
    ["biceps_cm", -4.2, "favorable"],
    ["biceps_cm", 1.2, "adverse"],
    ["hips_cm", 0.6, "adverse"],
  ] as const)("%s with a delta of %s verdicts %s", (kind, delta, verdict) => {
    expect(formatMeasurementDelta(kind, delta).verdict).toBe(verdict);
  });

  it("renders an exact zero delta with no sign and a neutral verdict", () => {
    const result = formatMeasurementDelta("waist_cm", 0);

    expect(result.text).toBe("0,0 cm");
    expect(result.verdict).toBe("neutral");
  });

  // Decision 6's own named trap: a raw delta whose text rounds to "0,0"
  // must verdict neutral too, or the text and the fill color would
  // contradict each other on the same zone (task 4 locks the same case
  // at the view-model level).
  it("rounds -0,04 to a signless 0,0 cm AND verdicts neutral, not favorable/adverse", () => {
    const result = formatMeasurementDelta("waist_cm", -0.04);

    expect(result.text).toBe("0,0 cm");
    expect(result.verdict).toBe("neutral");
  });

  it("keeps the decimal on a whole-number delta — '-2,0 kg', never '-2 kg'", () => {
    expect(formatMeasurementDelta("weight_kg", -2).text).toBe("-2,0 kg");
  });

  it("puts a non-breaking space (U+00A0) before % — asserted on the code point, not a visual space", () => {
    const { text } = formatMeasurementDelta("muscle_pct", 1.4);

    expect(text).toBe("+1,4 %");
    expect(text.charCodeAt(text.indexOf("%") - 1)).toBe(0x00a0);
  });

  it("shows an explicit + sign for a positive delta", () => {
    expect(formatMeasurementDelta("biceps_cm", 1.2).text).toBe("+1,2 cm");
  });
});
