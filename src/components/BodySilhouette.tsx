import type { BodyMapView, ViewEntry } from "@/lib/body-map-view";
import { MEASUREMENT_CATALOG_BY_KIND } from "@/lib/measurements";
import type { ProfileSex } from "@/lib/profile";
import { deltaLineClasses, thirdLine } from "@/lib/measurement-display";
import {
  SILHOUETTES,
  placeZones,
  type LabelSide,
  type PlacedZone,
} from "@/lib/silhouette";

/**
 * ADR 020, the redesign's centrepiece: the line-art silhouette with a
 * measurement read off each side.
 *
 * It replaces src/components/BodyMap.tsx's geometric body (7 filled
 * zones tinted by verdict), which is deleted — nothing rendered it any
 * more. Its wording/colour helpers survive in
 * src/lib/measurement-display.ts, still the single definition shared
 * with the stat cards.
 *
 * The dashed lines are no longer drawn here. `man.svg` and `woman.svg`
 * carry their own, so this component's job shrank to one thing: putting
 * each label next to the line the DRAWING already places. Where those
 * lines are, per sex, and how the labels are spread around them, lives
 * in src/lib/silhouette.ts — pure data and pure geometry, testable
 * without a DOM.
 */

const NONE_ENTRY: ViewEntry = {
  state: "none",
  valueText: null,
  deltaText: null,
  verdict: null,
};

const PANEL_HEIGHT = 402;
const IMAGE_HEIGHT = 380;
const IMAGE_TOP = 8;
const LABEL_WIDTH = 100;
/**
 * Measured, not guessed: one label block is a 0.75rem name, a 0.875rem
 * value and a 0.75rem progress line, which lay out to 56px. It is
 * declared here because the spreading maths needs a number before
 * anything renders — and it is the one value in this file that would
 * silently misplace every label if the label's own markup changed.
 */
const LABEL_HEIGHT = 56;
const LABEL_MIN_GAP = 4;

function ZoneLabel({
  zone,
  entry,
  side,
}: {
  zone: PlacedZone;
  entry: ViewEntry;
  side: LabelSide;
}) {
  const { label } = MEASUREMENT_CATALOG_BY_KIND[zone.kind];
  return (
    <div
      data-zone-label
      className={
        side === "left"
          ? "absolute left-0 text-left"
          : "absolute right-0 text-right"
      }
      style={{ top: `${zone.labelTop}px`, width: `${LABEL_WIDTH}px` }}
    >
      <span data-zone-name className="block text-label-min text-muted-foreground">
        {label}
      </span>
      <span className="block text-sm font-semibold tabular-nums">
        {entry.valueText ?? "—"}
      </span>
      {/* Not run through cn()/twMerge: "text-label-min" is a font-SIZE
          utility from this project's theme and deltaLineClasses returns
          a text-COLOR one. twMerge, which doesn't know these custom
          keys, reads both as the same "text-" group and drops one. */}
      <span
        data-zone-third-line
        className={`block text-label-min tabular-nums ${deltaLineClasses(entry.verdict)}`}
      >
        {thirdLine(entry)}
      </span>
    </div>
  );
}

export function BodySilhouette({
  view,
  sex,
}: {
  view: BodyMapView;
  sex: ProfileSex;
}) {
  const silhouette = SILHOUETTES[sex];
  const zones = placeZones(silhouette, {
    imageHeight: IMAGE_HEIGHT,
    imageTop: IMAGE_TOP,
    labelHeight: LABEL_HEIGHT,
    minGap: LABEL_MIN_GAP,
    panelHeight: PANEL_HEIGHT,
  });

  return (
    <div
      className="relative mx-auto w-full max-w-[358px]"
      style={{ height: `${PANEL_HEIGHT}px` }}
    >
      {/* A plain <img>, not an inlined SVG component and not next/image.
          Inlining would put ~13 KB of path data in the JS bundle for a
          drawing that never changes; next/image would run a raster
          optimiser over a vector. `dark:invert` is what carries the
          theme: the file is black line art on transparent, and inverting
          it is exactly the white-on-dark the dark palette wants —
          `currentColor` can't cross an <img> boundary. It inverts the
          drawing's own dashed lines too, #ccc becoming #333 — a light
          grey on white turning into a dark grey on near-black, which is
          the same weak contrast either way round, by design. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
      <img
        src={silhouette.src}
        alt=""
        aria-hidden="true"
        className="absolute left-1/2 -translate-x-1/2 dark:invert"
        style={{ top: `${IMAGE_TOP}px`, height: `${IMAGE_HEIGHT}px` }}
      />

      {zones.map((zone) => (
        <ZoneLabel
          key={zone.kind}
          zone={zone}
          side={zone.side}
          entry={view.measurements[zone.kind] ?? NONE_ENTRY}
        />
      ))}
    </div>
  );
}
