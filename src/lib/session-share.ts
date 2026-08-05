import { computeBmi, formatBmi } from "./bmi";
import { formatSessionDate } from "./date";
import type { MeasurementSessionSummary } from "./measurement-sessions";
import {
  MEASUREMENT_CATALOG,
  formatMeasurementValue,
  type MeasurementKind,
} from "./measurements";

/**
 * The plain text a session is shared as — one measurement per line, ready
 * to paste into WhatsApp, a note, a mail. Pure and framework-free on
 * purpose: the button that shares it is a client island
 * (src/components/ShareSessionButton.tsx), but the string itself is built
 * on the server, by the same Server Component that already renders the
 * row — so what is shared is by construction what is displayed, never a
 * second formatting of the same numbers.
 *
 * Every number goes through `formatMeasurementValue` / `formatBmi`, the
 * display-surface formatters (design-system.md §Format numérique) — the
 * share text IS a display surface. Deliberately NOT
 * `formatMeasurementValueForInput`: that one exists to be re-read by
 * `parseMeasurementInput`, and drops the unit, which is exactly the
 * information a message needs to carry.
 *
 * Order comes from MEASUREMENT_CATALOG, not from the order the rows
 * happen to arrive in — the canonical display order (§ the catalog's own
 * doc comment), the one the entry form and the charts selector already
 * use. `session.measurements` only holds the kinds actually recorded, so
 * a weight-only session produces exactly one measurement line: an
 * unfilled field is absent here too, never a zero (ADR 004).
 *
 * The IMC line is derived on read from `heightCm`, through the one
 * `computeBmi` in the repo — the same call the row's own suffix makes, so
 * the shared text and the screen can never disagree, and no height means
 * no line at all rather than a dash or a NaN.
 *
 * A plain space before the colon, not a non-breaking one: the destination
 * is arbitrary plain text in someone else's app, where a U+00A0 survives
 * copy-paste unevenly. The non-breaking space the design system does
 * mandate — the one before `%` — is inside `formatMeasurementValue` and
 * is untouched by this choice.
 */
export function buildSessionShareText(
  session: Pick<MeasurementSessionSummary, "measuredOn" | "measurements">,
  heightCm: number | null,
): string {
  const valueByKind = new Map<MeasurementKind, number>(
    session.measurements.map((measurement) => [
      measurement.kind,
      measurement.value,
    ]),
  );

  const lines = [`Mesures du ${formatSessionDate(session.measuredOn, "UTC")}`];

  for (const entry of MEASUREMENT_CATALOG) {
    const value = valueByKind.get(entry.kind);
    if (value === undefined) continue;
    lines.push(
      `${entry.label} : ${formatMeasurementValue(value, entry.unit)}`,
    );
  }

  const bmi = computeBmi(valueByKind.get("weight_kg") ?? null, heightCm);
  if (bmi !== null) {
    lines.push(`IMC : ${formatBmi(bmi)}`);
  }

  return lines.join("\n");
}
