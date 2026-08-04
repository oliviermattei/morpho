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

export function verdictGlyph(verdict: MeasurementVerdict | null): string {
  if (verdict === "favorable") return "▲ ";
  if (verdict === "adverse") return "▼ ";
  return "";
}

export function deltaLineClasses(verdict: MeasurementVerdict | null): string {
  if (verdict === "favorable") return "text-progress-favorable";
  if (verdict === "adverse") return "text-progress-adverse";
  return "text-muted-foreground";
}

export function thirdLine(entry: ViewEntry): string {
  if (entry.state === "none") return "Aucune mesure";
  if (entry.state === "single") return "1 mesure";
  return `${verdictGlyph(entry.verdict)}${entry.deltaText}`;
}
