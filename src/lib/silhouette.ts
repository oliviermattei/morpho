import type { MeasurementKind } from "./measurements";
import type { ProfileSex } from "./profile";

/**
 * Where each measurement's line sits ON each drawing, and how the labels
 * are laid out around them.
 *
 * The drawings changed shape: `man.svg` and `woman.svg` carry their own
 * dashed measurement lines, baked into the file. Before, the SVG was a
 * bare body and this app drew seven HTML rules on top of it at
 * hand-tuned pixel offsets. That inverted the authority — the drawing
 * knew where a waist was, the component guessed. Now the drawing is the
 * source of truth and the labels are placed FROM it.
 *
 * A man's and a woman's proportions differ, so the same measurement sits
 * at a different height on each: the man's hips line is at y=651.66, the
 * woman's at y=616.97. Hence one table per sex, never one shared table
 * with a fudge factor.
 */

/**
 * Both files declare `viewBox="0 0 442.44 1208"`. Every `y` below is in
 * those units, read straight out of the `<line>` elements — NOT in
 * pixels. That is what makes the layout independent of the size the
 * drawing is rendered at: change the rendered height and every label
 * follows, because each one is placed at `y / 1208` of it.
 */
export const SILHOUETTE_VIEWBOX_HEIGHT = 1208;
export const SILHOUETTE_VIEWBOX_WIDTH = 442.44;

export type LabelSide = "left" | "right";

export interface SilhouetteZone {
  kind: MeasurementKind;
  /**
   * Which column the label sits in.
   *
   * Not a free design choice: it is dictated by how far that zone's line
   * reaches in the drawing. The biceps line spans x 323→422, out on the
   * figure's right arm, so its label can only be read on the right. The
   * thigh (x 85→236) and calf (x 105→218) lines run along the left leg,
   * so those two go left. The other four span the full width and could
   * face either way — they are assigned to keep neighbouring lines in
   * OPPOSITE columns, which is what stops two labels a few pixels apart
   * from having to share one.
   */
  side: LabelSide;
  /** Y of this zone's dashed line in the drawing, in viewBox units. */
  y: number;
}

export interface Silhouette {
  src: string;
  zones: SilhouetteZone[];
}

// Verified against the rendered drawings, not inferred from the numbers:
// each line was read off the file and then checked on screen against the
// body part it crosses.
export const SILHOUETTES: Record<ProfileSex, Silhouette> = {
  male: {
    src: "/silhouettes/man.svg",
    zones: [
      { kind: "shoulders_cm", side: "right", y: 284 },
      { kind: "chest_cm", side: "left", y: 353.15 },
      { kind: "biceps_cm", side: "right", y: 390.33 },
      { kind: "waist_cm", side: "left", y: 462 },
      { kind: "hips_cm", side: "right", y: 651.66 },
      { kind: "thigh_cm", side: "left", y: 709 },
      { kind: "calf_cm", side: "left", y: 967 },
    ],
  },
  female: {
    src: "/silhouettes/woman.svg",
    zones: [
      { kind: "shoulders_cm", side: "right", y: 262.06 },
      { kind: "chest_cm", side: "left", y: 330.91 },
      { kind: "biceps_cm", side: "right", y: 387.01 },
      { kind: "waist_cm", side: "left", y: 437.47 },
      { kind: "hips_cm", side: "right", y: 616.97 },
      { kind: "thigh_cm", side: "left", y: 701 },
      { kind: "calf_cm", side: "left", y: 942 },
    ],
  },
};

export interface PlacementOptions {
  /** Rendered height of the drawing, in px. */
  imageHeight: number;
  /** Offset of the drawing's top edge from the panel's top, in px. */
  imageTop: number;
  /** Height of one three-line label block, in px. */
  labelHeight: number;
  /** Smallest vertical space allowed between two label blocks, in px. */
  minGap: number;
  /** Height of the whole panel, in px — nothing may be placed past it. */
  panelHeight: number;
}

export interface PlacedZone extends SilhouetteZone {
  /** Where that zone's line falls in the panel, in px. */
  lineTop: number;
  /** Where its label block starts, in px. */
  labelTop: number;
}

/** Where a zone's line lands once the drawing is rendered at a given size. */
export function lineTopPx(
  y: number,
  { imageHeight, imageTop }: Pick<PlacementOptions, "imageHeight" | "imageTop">,
): number {
  return imageTop + (y / SILHOUETTE_VIEWBOX_HEIGHT) * imageHeight;
}

/**
 * Spaces one column's labels out so none overlaps, moving each as little
 * as possible from the line it belongs to.
 *
 * Centring every label on its own line is what the eye wants, and it is
 * geometrically impossible here: on the man, the shoulders line and the
 * chest line are 69 viewBox units apart — about 22px at the size the
 * drawing is rendered — while a three-line label block is 56px tall. Two
 * of them centred on those lines would overlap by more than half.
 *
 * So the displacement is unavoidable; what matters is that it is SHARED.
 * A single downward pass would be simpler and is wrong: it leaves the
 * first label of a colliding pair exactly on its line and shoves the
 * whole error onto the second, which ends up 26px off — its line grazing
 * the top edge of its own box. Splitting the error puts each of the two
 * 13px off instead, and 13px still leaves every line crossing the label
 * it belongs to.
 *
 * Sharing it optimally is a known problem. Substituting
 * `u[i] = top[i] - i * step` turns "keep them `step` apart, in order"
 * into "keep `u` non-decreasing", and the nearest non-decreasing
 * sequence is what pool-adjacent-violators computes: walk left to right,
 * and whenever a value dips below the block before it, merge the two
 * blocks and give both their mean. What comes out minimises the total
 * squared displacement, which is exactly "move everything as little as
 * possible".
 */
export function spreadColumn(
  idealTops: readonly number[],
  { labelHeight, minGap, panelHeight }: Omit<PlacementOptions, "imageHeight" | "imageTop">,
): number[] {
  const step = labelHeight + minGap;
  if (idealTops.length === 0) return [];

  interface Block {
    firstIndex: number;
    count: number;
    /** Sum of the members' substituted values, so mean = sum / count. */
    sum: number;
  }

  const blocks: Block[] = [];
  idealTops.forEach((ideal, index) => {
    let block: Block = { firstIndex: index, count: 1, sum: ideal - index * step };

    // Merge backwards for as long as this block would start above the
    // one before it — the definition of an overlap, in substituted space.
    while (blocks.length > 0) {
      const previous = blocks[blocks.length - 1]!;
      if (previous.sum / previous.count <= block.sum / block.count) break;
      blocks.pop();
      block = {
        firstIndex: previous.firstIndex,
        count: previous.count + block.count,
        sum: previous.sum + block.sum,
      };
    }

    blocks.push(block);
  });

  const tops: number[] = [];
  for (const block of blocks) {
    const base = block.sum / block.count;
    for (let k = 0; k < block.count; k += 1) {
      const index = block.firstIndex + k;
      tops[index] = base + index * step;
    }
  }

  // Bring the column back inside the panel. Both corrections are uniform
  // shifts, which change no distance between two labels and so cannot
  // reintroduce an overlap.
  const overflow = tops[tops.length - 1]! + labelHeight - panelHeight;
  if (overflow > 0) {
    for (let i = 0; i < tops.length; i += 1) tops[i] = tops[i]! - overflow;
  }
  if (tops[0]! < 0) {
    const lift = tops[0]!;
    for (let i = 0; i < tops.length; i += 1) tops[i] = tops[i]! - lift;
  }

  return tops;
}

/**
 * The whole layout: every zone of one silhouette, with its line and its
 * label already placed in panel pixels.
 *
 * Each column is spread independently — labels in different columns
 * cannot collide, so constraining them together would move labels off
 * their lines for no reason.
 */
export function placeZones(
  silhouette: Silhouette,
  options: PlacementOptions,
): PlacedZone[] {
  return (["left", "right"] as const).flatMap((side) => {
    const zones = silhouette.zones
      .filter((zone) => zone.side === side)
      .sort((a, b) => a.y - b.y);

    const lineTops = zones.map((zone) => lineTopPx(zone.y, options));
    const labelTops = spreadColumn(
      lineTops.map((top) => top - options.labelHeight / 2),
      options,
    );

    return zones.map((zone, index) => ({
      ...zone,
      lineTop: lineTops[index]!,
      labelTop: labelTops[index]!,
    }));
  });
}
