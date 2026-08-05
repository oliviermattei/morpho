import { z } from "zod";
import { measurementKind } from "./db/schema";
import { formatFrenchNumber } from "./format-number";

/**
 * s09 plan P4: the id in /historique/[id] and the equivalent route
 * handler segment. measurement_sessions.id is declared uuid (s03 task 1,
 * app-generated via crypto.randomUUID(), s03 decision 10) — the type is
 * known, not left to the implementer to guess between this and
 * z.coerce.number() (a wrong guess would make every session 404,
 * including the caller's own, while the "malformed id" test stayed
 * green). Traversed by the page (task 8) and both route handler methods
 * (task 6).
 */
export const sessionIdSchema = z.uuid();

/**
 * The type every "kind" field in this story derives from, never
 * redeclared: the Drizzle enum in src/lib/db/schema.ts stays the single
 * source of which 10 kinds exist and in what order.
 */
export type MeasurementKind = (typeof measurementKind.enumValues)[number];

export type MeasurementGroup = "poids" | "mensurations" | "composition";

export type MeasurementUnit = "kg" | "cm" | "%";

/**
 * Where a tracked measurement's zone sits on the silhouette (s06 task 1,
 * decision 2 and 20): recopied from docs/designs/s06-body-map.md's
 * geometry section. `top` is a percentage of the body-map container's
 * height, consumed as a `style` value (never an arbitrary Tailwind
 * class — design-system.md §Espacement). Only the 7 kinds with a body
 * zone carry this; weight and the two percentages have none. `label` is
 * the compact zone name shown in the 30%-wide label column — distinct
 * from `label` above for waist_cm ("Taille", not "Tour de taille": the
 * longer form doesn't fit the column without wrapping past 3 lines).
 */
export interface BodyMapZoneGeometry {
  label: string;
  column: "left" | "right";
  top: number;
}

export interface MeasurementCatalogEntry {
  kind: MeasurementKind;
  label: string;
  group: MeasurementGroup;
  unit: MeasurementUnit;
  min: number;
  max: number;
  bodyMapZone?: BodyMapZoneGeometry;
}

/**
 * Physiological ranges and French labels for the 10 tracked measurements,
 * declared in one place (docs/architecture.md, "les plages physiologiques
 * sont déclarées par kind, au même endroit").
 *
 * This array's order is the ENTRY order — the order the fields appear in
 * on /saisie, in its skeleton and in the charts selector. It used to be
 * identical to measurementKind.enumValues and was locked to it by test.
 * It no longer is: the biceps moved to the end of the mensurations, at
 * the user's request, and a Postgres enum's order is fixed at creation —
 * `ALTER TYPE` can add values but cannot reorder existing ones, so
 * matching the change in the database would mean recreating the type
 * under live data for a purely cosmetic gain. The enum keeps the storage
 * order, this array owns the display order, and the test now locks that
 * the two hold the same SET of kinds rather than the same sequence.
 *
 * The ranges are deliberately wide: they catch a typo (500cm, 101%, -5kg),
 * not an atypical body (plan decision 4).
 */
export const MEASUREMENT_CATALOG: readonly MeasurementCatalogEntry[] = [
  {
    kind: "weight_kg",
    label: "Poids",
    group: "poids",
    unit: "kg",
    min: 20,
    max: 400,
  },
  {
    kind: "shoulders_cm",
    label: "Épaules",
    group: "mensurations",
    unit: "cm",
    min: 60,
    max: 200,
    bodyMapZone: { label: "Épaules", column: "left", top: 1 },
  },
  {
    kind: "chest_cm",
    label: "Poitrine",
    group: "mensurations",
    unit: "cm",
    min: 50,
    max: 200,
    bodyMapZone: { label: "Poitrine", column: "left", top: 20 },
  },
  {
    // "Taille", reverted from "Tour de taille" at the user's request.
    // s03 had chosen the long form to avoid colliding with the s04
    // reference height, which French also calls a "taille" — but the two
    // never appear on the same screen: the height lives on /profil, in a
    // field that spells out "Taille (cm)" under a "Taille de référence"
    // legend. The short form is also what the redesign's silhouette
    // column needs (ADR 020) — the long one wraps.
    kind: "waist_cm",
    label: "Taille",
    group: "mensurations",
    unit: "cm",
    min: 40,
    max: 200,
    bodyMapZone: { label: "Taille", column: "right", top: 30 },
  },
  {
    kind: "hips_cm",
    label: "Hanches",
    group: "mensurations",
    unit: "cm",
    min: 50,
    max: 200,
    bodyMapZone: { label: "Hanches", column: "left", top: 43 },
  },
  {
    kind: "thigh_cm",
    label: "Cuisse",
    group: "mensurations",
    unit: "cm",
    min: 25,
    max: 120,
    bodyMapZone: { label: "Cuisse", column: "right", top: 56 },
  },
  {
    kind: "calf_cm",
    label: "Mollet",
    group: "mensurations",
    unit: "cm",
    min: 15,
    max: 80,
    bodyMapZone: { label: "Mollet", column: "left", top: 74 },
  },
  {
    kind: "biceps_cm",
    label: "Biceps",
    group: "mensurations",
    unit: "cm",
    min: 15,
    max: 80,
    bodyMapZone: { label: "Biceps", column: "right", top: 9 },
  },
  {
    kind: "body_fat_pct",
    label: "Masse grasse",
    group: "composition",
    unit: "%",
    min: 1,
    max: 70,
  },
  {
    kind: "muscle_pct",
    label: "Masse musculaire",
    group: "composition",
    unit: "%",
    min: 10,
    max: 90,
  },
];

export const MEASUREMENT_CATALOG_BY_KIND: Readonly<
  Record<MeasurementKind, MeasurementCatalogEntry>
> = Object.fromEntries(
  MEASUREMENT_CATALOG.map((entry) => [entry.kind, entry]),
) as Record<MeasurementKind, MeasurementCatalogEntry>;

export type MeasurementInputResult =
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "value"; value: number };

// Digits, optionally with one fractional group after a dot or a French
// comma. Deliberately rejects a leading sign (so "-5" is "invalid", not a
// negative value to reject later by range), scientific notation ("1e3"),
// and more than one separator ("7,2,1").
const NUMERIC_PATTERN = /^\d+([.,]\d+)?$/;

/**
 * Classifies a raw form value before any numeric coercion touches it.
 * Named trap (research §5, plan task 3): `z.coerce.number().safeParse("")`
 * returns `{ success: true, data: 0 }` — Zod does not catch an empty
 * string on its own. This function exists so that case is classified as
 * "empty" here, never allowed to reach a coercion that would fabricate a
 * zero (the repo-wide vide ≠ zéro trap, ADR 004).
 */
export function parseMeasurementInput(raw: string): MeasurementInputResult {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { status: "empty" };
  }
  if (!NUMERIC_PATTERN.test(trimmed)) {
    return { status: "invalid" };
  }
  const normalized = trimmed.replace(",", ".");
  const value = Math.round(Number(normalized) * 10) / 10;
  return { status: "value", value };
}

// Mirrors src/lib/measurement-session-input.ts's own phrasing for the same
// two failure modes (s03) — kept local rather than imported, so this
// module never reaches into a module that itself imports from here
// (measurement-session-input.ts imports parseMeasurementInput from this
// file; importing back would be a cycle). Exported: task 6's route
// handler reuses this exact string for the one case buildDesiredMeasurements
// itself never sees — a raw JSON value that isn't even a string.
export const MEASUREMENT_VALUE_INVALID_MESSAGE =
  "Valeur non reconnue. Utilisez des chiffres, avec une virgule si besoin (ex. 82,4).";

function measurementRangeErrorMessage(entry: MeasurementCatalogEntry): string {
  return `${entry.label} doit être compris entre ${entry.min} et ${entry.max} ${entry.unit}.`;
}

export interface DesiredMeasurementsResult {
  values: Partial<Record<MeasurementKind, number>>;
  fieldErrors: Partial<Record<MeasurementKind, string>>;
}

/**
 * s09 plan task 2, R13's one new function, R3's "état désiré": from the
 * raw string of every measurement field on the edit form, builds the
 * state the session's measurements should have AFTER saving — a key
 * ABSENT from `values` means "this measurement must not exist", never a
 * stored 0 (the story's trap 3, the repo-wide vide ≠ zéro rule, ADR 004).
 *
 * Written directly against parseMeasurementInput's discriminated union:
 * `{status:"empty"}` (including a key missing from `rawFields` entirely)
 * → key absent from `values`; `{status:"invalid"}` → a field error,
 * `values` untouched; `{status:"value"}` → range-checked against the
 * kind's own catalog entry (the same physiological bounds s03's payload
 * validation applies), then either a value or a range field error.
 *
 * Never a second parser: the only classification this function performs
 * itself is the numeric range check — the string-to-number classification
 * stays entirely parseMeasurementInput's job.
 */
export function buildDesiredMeasurements(
  rawFields: Partial<Record<MeasurementKind, string>>,
): DesiredMeasurementsResult {
  const values: Partial<Record<MeasurementKind, number>> = {};
  const fieldErrors: Partial<Record<MeasurementKind, string>> = {};

  for (const entry of MEASUREMENT_CATALOG) {
    const raw = rawFields[entry.kind];
    if (raw === undefined) continue;

    const parsed = parseMeasurementInput(raw);
    if (parsed.status === "empty") continue;

    if (parsed.status === "invalid") {
      fieldErrors[entry.kind] = MEASUREMENT_VALUE_INVALID_MESSAGE;
      continue;
    }

    if (parsed.value < entry.min || parsed.value > entry.max) {
      fieldErrors[entry.kind] = measurementRangeErrorMessage(entry);
      continue;
    }

    values[entry.kind] = parsed.value;
  }

  return { values, fieldErrors };
}

const NON_BREAKING_SPACE = " ";

/**
 * Design system §Format numérique: French decimal comma, one decimal, no
 * superfluous trailing zero (`82,4 kg`, never `82,40 kg`), unit stuck to
 * the value with a non-breaking space before `%`. The number itself is
 * formatted by src/lib/format-number.ts's formatFrenchNumber — the one
 * rounding rule the project uses (plan s04, P2), shared with
 * src/lib/bmi.ts's formatBmi rather than duplicated for a value that has
 * no unit.
 */
export function formatMeasurementValue(
  value: number,
  unit: MeasurementUnit,
): string {
  const separator = unit === "%" ? NON_BREAKING_SPACE : " ";
  return `${formatFrenchNumber(value)}${separator}${unit}`;
}

/**
 * The value to put inside an editable measurement <input> when it is
 * prefilled (plan R3, corrected): French comma, no unit, no non-breaking
 * space — formatMeasurementValue glues the unit on ("82,4 kg"), which a
 * field parseMeasurementInput must still be able to read would reject.
 * Domain: the values numeric(5,1) can actually store, at most one
 * decimal — on that domain this is String(value).replace(".", ",").
 */
export function formatMeasurementValueForInput(value: number): string {
  return String(value).replace(".", ",");
}

export type MeasurementVerdict = "favorable" | "adverse" | "neutral";

export interface MeasurementDeltaResult {
  text: string;
  verdict: MeasurementVerdict;
}

/**
 * The colour rule for every measurement, at the user's request: a value
 * that goes DOWN is favorable (green), a value that goes UP is adverse
 * (red), an unchanged value is neutral (plain text). The per-kind
 * "favorable direction" table this used to consult (up for the biceps,
 * down for the waist) is gone — one rule now, no case-by-case.
 *
 * Rounds FIRST (one decimal, matching what formatFrenchNumber displays),
 * THEN qualifies the rounded result. Named trap: a raw delta of -0.04
 * displays "0,0 cm" — qualified on the raw value it would render neutral
 * text in a coloured pill on the same millimeter of screen.
 */
export function verdictForDelta(delta: number): MeasurementVerdict {
  // Same rounding rule as formatFrenchNumber's own halfExpand default
  // (round half away from zero), computed independently so the verdict
  // always agrees with what the text actually shows.
  const roundedDelta =
    (Math.sign(delta) * Math.round(Math.abs(delta) * 10)) / 10;
  if (roundedDelta === 0) return "neutral";
  return roundedDelta < 0 ? "favorable" : "adverse";
}

/**
 * Plan s06 task 2, decision 19: one of only two places in the repo
 * allowed to assign a `verdict` (the other is src/lib/body-map-view.ts,
 * which only ever recopies what this function returns or calls
 * verdictForDelta above — it never writes its own rule).
 */
export function formatMeasurementDelta(
  kind: MeasurementKind,
  delta: number,
): MeasurementDeltaResult {
  const entry = MEASUREMENT_CATALOG_BY_KIND[kind];
  const separator = entry.unit === "%" ? NON_BREAKING_SPACE : " ";
  const text = `${formatFrenchNumber(delta, {
    signDisplay: "exceptZero",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}${separator}${entry.unit}`;

  return { text, verdict: verdictForDelta(delta) };
}
