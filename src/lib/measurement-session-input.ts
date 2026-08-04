import { z } from "zod";
import {
  MEASUREMENT_CATALOG,
  parseMeasurementInput,
  type MeasurementCatalogEntry,
  type MeasurementKind,
} from "./measurements";

export interface ParsedMeasurementSessionInput {
  measuredOn: string;
  measurements: { kind: MeasurementKind; value: number }[];
}

export type MeasurementSessionInputResult =
  | { ok: true; value: ParsedMeasurementSessionInput }
  | {
      ok: false;
      fieldErrors: Record<string, string[]>;
      formErrors: string[];
    };

// Plan decision 9: "today" is never computed server-side — the client
// sends the device's own date. The server only bounds the window it
// accepts, wide enough for every timezone ahead of UTC (up to +14h)
// without opening arbitrary future dates.
//
// Exported so MeasurementSessionForm can compose the same window into the
// date input's min/max as a client-side courtesy (review finding 1): the
// server stays the sole authority, the client just stops offering a
// choice it would refuse anyway. Single source, never redeclared.
export const MIN_MEASURED_ON = "2000-01-01";

export function maxAllowedMeasuredOn(now: Date): string {
  const tomorrowUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return tomorrowUtc.toISOString().slice(0, 10);
}

// Named trap (research §6, plan task 4): the Zod 3 `invalid_type_error`
// param from next/dist/docs/01-app/02-guides/forms.md's example is
// silently ignored on the Zod 4 installed here — `{ error: "…" }` is what
// actually surfaces a custom message (research §5, verified by execution).
const isoDateSchema = z.iso.date({
  error: "La date n'est pas reconnue.",
});

const MEASUREMENT_VALUE_INVALID_MESSAGE =
  "Valeur non reconnue. Utilisez des chiffres, avec une virgule si besoin (ex. 82,4).";

function rangeErrorMessage(entry: MeasurementCatalogEntry): string {
  return `${entry.label} doit être compris entre ${entry.min} et ${entry.max} ${entry.unit}.`;
}

/**
 * Server-side validation of a POST /api/sessions payload — the only
 * authority, even though the client already validated (AGENTS.md,
 * "Validate every payload with Zod on the server"). Empty fields are
 * discarded by src/lib/measurements.ts's parseMeasurementInput before any
 * numeric coercion runs, so an absent measurement never becomes a stored
 * 0 (ADR 004). Issues are collected as real Zod issues and aggregated
 * through z.flattenError(), in the { formErrors, fieldErrors } shape
 * verified in research §5 — not a hand-rolled lookalike.
 *
 * `now` defaults to the real clock and exists so tests can pin it —
 * the date window below is computed relative to it.
 */
export function parseMeasurementSessionInput(
  payload: unknown,
  now: Date = new Date(),
): MeasurementSessionInputResult {
  const issues: z.core.$ZodIssue[] = [];
  const record =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};

  let measuredOn: string | undefined;
  const dateResult = isoDateSchema.safeParse(record.measuredOn);
  if (!dateResult.success) {
    issues.push({
      code: "custom",
      path: ["measuredOn"],
      message: "La date n'est pas reconnue.",
      input: record.measuredOn,
    });
  } else if (
    dateResult.data < MIN_MEASURED_ON ||
    dateResult.data > maxAllowedMeasuredOn(now)
  ) {
    issues.push({
      code: "custom",
      path: ["measuredOn"],
      message: "Cette date n'est pas valide.",
      input: dateResult.data,
    });
  } else {
    measuredOn = dateResult.data;
  }

  const measurements: { kind: MeasurementKind; value: number }[] = [];
  let hasAnyNonEmptyField = false;

  for (const entry of MEASUREMENT_CATALOG) {
    const raw = record[entry.kind];
    if (raw === undefined || raw === null) continue;

    if (typeof raw !== "string") {
      hasAnyNonEmptyField = true;
      issues.push({
        code: "custom",
        path: [entry.kind],
        message: MEASUREMENT_VALUE_INVALID_MESSAGE,
        input: raw,
      });
      continue;
    }

    const parsed = parseMeasurementInput(raw);
    if (parsed.status === "empty") continue;
    hasAnyNonEmptyField = true;

    if (parsed.status === "invalid") {
      issues.push({
        code: "custom",
        path: [entry.kind],
        message: MEASUREMENT_VALUE_INVALID_MESSAGE,
        input: raw,
      });
      continue;
    }

    if (parsed.value < entry.min || parsed.value > entry.max) {
      issues.push({
        code: "custom",
        path: [entry.kind],
        message: rangeErrorMessage(entry),
        input: parsed.value,
      });
      continue;
    }

    measurements.push({ kind: entry.kind, value: parsed.value });
  }

  // Criterion 4: an entirely empty form is refused with a message, and it
  // is refused here — not by the date, which the client always populates
  // with a default (criterion 1) and is validated independently above.
  if (!hasAnyNonEmptyField) {
    issues.push({
      code: "custom",
      path: [],
      message: "Renseignez au moins une mesure avant d'enregistrer.",
      input: record,
    });
  }

  if (issues.length > 0) {
    const { fieldErrors, formErrors } = z.flattenError(
      new z.ZodError(issues),
    );
    return { ok: false, fieldErrors, formErrors };
  }

  // issues.length === 0 guarantees the date branch above set measuredOn.
  return { ok: true, value: { measuredOn: measuredOn as string, measurements } };
}
