import type { BodyMapView, ViewEntry } from "@/lib/body-map-view";
import {
  MEASUREMENT_CATALOG_BY_KIND,
  type MeasurementKind,
} from "@/lib/measurements";
import type { ProfileSex } from "@/lib/profile";
import { deltaLineClasses, thirdLine } from "@/lib/measurement-display";

/**
 * ADR 020, the redesign's centrepiece: the line-art silhouette with
 * dashed leader lines running out to a measurement on each side.
 *
 * It replaces src/components/BodyMap.tsx's geometric body (7 filled
 * zones tinted by verdict), which is deleted — nothing rendered it any
 * more. Its wording/colour helpers survive in
 * src/lib/measurement-display.ts, still the single definition shared
 * with the stat cards.
 *
 * The panel is 402px tall with px offsets, exactly as the design
 * specifies, rather than percentages: the label rows have to line up
 * with anatomical features of a fixed-height drawing, and a percentage
 * would only be equivalent as long as the drawing's aspect ratio never
 * changes. Horizontal placement IS edge-anchored (left-0 / right-0 /
 * inset-x), so the panel still degrades correctly below the design's
 * 390px card.
 */

interface LabelGeometry {
  kind: MeasurementKind;
  /** Top of the three-line label block, in px from the panel's top. */
  top: number;
  /** Top of the dashed leader line, in px — where it meets the body. */
  line: number;
}

interface SilhouetteGeometry {
  src: string;
  left: LabelGeometry[];
  right: LabelGeometry[];
}

/**
 * Recopied verbatim from the design's own `renderVals()` — pure
 * coordinates, per silhouette. The two bodies are drawn differently
 * (the female one's hips and calves sit lower), so they do NOT share a
 * table: reusing the male offsets would float the female "Hanches"
 * label 15px above the hips it points at.
 */
const GEOMETRY: Record<ProfileSex, SilhouetteGeometry> = {
  male: {
    src: "/silhouettes/homme.svg",
    left: [
      { kind: "shoulders_cm", top: 48, line: 79 },
      { kind: "chest_cm", top: 109, line: 124 },
      { kind: "hips_cm", top: 188, line: 217 },
      { kind: "calf_cm", top: 302, line: 331 },
    ],
    right: [
      { kind: "biceps_cm", top: 97, line: 132 },
      { kind: "waist_cm", top: 165, line: 185 },
      { kind: "thigh_cm", top: 238, line: 268 },
    ],
  },
  female: {
    src: "/silhouettes/femme.svg",
    left: [
      { kind: "shoulders_cm", top: 48, line: 79 },
      { kind: "chest_cm", top: 109, line: 132 },
      { kind: "hips_cm", top: 203, line: 241 },
      { kind: "calf_cm", top: 308, line: 342 },
    ],
    right: [
      { kind: "biceps_cm", top: 97, line: 135 },
      { kind: "waist_cm", top: 181, line: 209 },
      { kind: "thigh_cm", top: 251, line: 280 },
    ],
  },
};

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
// The dashed line starts past the label column and stops before its
// mirror, so it never runs under a value.
const LINE_INSET = 108;

function ZoneLabel({
  geometry,
  entry,
  side,
}: {
  geometry: LabelGeometry;
  entry: ViewEntry;
  side: "left" | "right";
}) {
  const { label } = MEASUREMENT_CATALOG_BY_KIND[geometry.kind];
  return (
    <div
      className={
        side === "left"
          ? "absolute left-0 text-left"
          : "absolute right-0 text-right"
      }
      style={{ top: `${geometry.top}px`, width: `${LABEL_WIDTH}px` }}
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

function LeaderLine({ top }: { top: number }) {
  return (
    <div
      aria-hidden="true"
      className="absolute border-t border-dashed border-border"
      style={{
        top: `${top}px`,
        left: `${LINE_INSET}px`,
        right: `${LINE_INSET}px`,
      }}
    />
  );
}

export function BodySilhouette({
  view,
  sex,
}: {
  view: BodyMapView;
  sex: ProfileSex;
}) {
  const geometry = GEOMETRY[sex];
  const zones = [
    ...geometry.left.map((g) => ({ geometry: g, side: "left" as const })),
    ...geometry.right.map((g) => ({ geometry: g, side: "right" as const })),
  ];

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
          `currentColor` can't cross an <img> boundary. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
      <img
        src={geometry.src}
        alt=""
        aria-hidden="true"
        className="absolute left-1/2 -translate-x-1/2 dark:invert"
        style={{ top: `${IMAGE_TOP}px`, height: `${IMAGE_HEIGHT}px` }}
      />

      {zones.map(({ geometry: zone }) => (
        <LeaderLine key={`line-${zone.kind}`} top={zone.line} />
      ))}

      {zones.map(({ geometry: zone, side }) => (
        <ZoneLabel
          key={zone.kind}
          geometry={zone}
          side={side}
          entry={view.measurements[zone.kind] ?? NONE_ENTRY}
        />
      ))}
    </div>
  );
}
