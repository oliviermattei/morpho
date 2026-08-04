import type { ViewEntry } from "./body-map-view";
import type { MeasurementVerdict } from "./measurements";

/**
 * ADR 020: the one definition of how a progress line is worded and
 * coloured, shared by the silhouette's zone labels
 * (src/components/BodySilhouette.tsx) and the stat cards
 * (src/components/StatCards.tsx).
 *
 * These three functions used to live in src/components/BodyMap.tsx and
 * were imported FROM the component that no longer renders. That file is
 * gone; keeping it alive purely as a home for helpers would have left a
 * dead silhouette in the tree with nothing rendering it.
 */

/**
 * The ▲/▼ glyphs are gone, and with them BodyMapLegend, which existed
 * only to explain them.
 *
 * They were redundant twice over. The delta text already carries its own
 * direction — every delta is formatted with `signDisplay: "exceptZero"`
 * (formatMeasurementDelta), so it reads "−3,2 kg" or "+2,1 pts" and never
 * a bare number. And the glyph pointed the WRONG way to be read as
 * direction anyway: ▲ meant "favorable", which is a value going *down*
 * for a weight and *up* for a biceps, so a ▲ next to "−3,2 kg" invited
 * exactly the misreading it was supposed to prevent.
 *
 * What is left is the split the screen actually needs: the sign says
 * which way the number moved, the colour says whether that is good for
 * this particular measurement — down is favorable for a weight, up is
 * favorable for a biceps (the `favorable` direction declared per kind in
 * src/lib/measurements.ts).
 */
export function deltaLineClasses(verdict: MeasurementVerdict | null): string {
  if (verdict === "favorable") return "text-progress-favorable";
  if (verdict === "adverse") return "text-progress-adverse";
  return "text-muted-foreground";
}

export function thirdLine(entry: ViewEntry): string {
  if (entry.state === "none") return "Aucune mesure";
  if (entry.state === "single") return "1 mesure";
  return entry.deltaText ?? "";
}
