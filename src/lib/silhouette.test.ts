import { describe, expect, it } from "vitest";
import { MEASUREMENT_CATALOG } from "./measurements";
import {
  SILHOUETTES,
  SILHOUETTE_VIEWBOX_HEIGHT,
  lineTopPx,
  placeZones,
  spreadColumn,
} from "./silhouette";

// The panel as BodySilhouette renders it. Kept here so the geometry can
// be exercised without a DOM.
const PLACEMENT = {
  imageHeight: 380,
  imageTop: 8,
  labelHeight: 56,
  minGap: 4,
  panelHeight: 402,
};

const MENSURATION_KINDS = MEASUREMENT_CATALOG.filter(
  (entry) => entry.group === "mensurations",
).map((entry) => entry.kind);

describe("SILHOUETTES", () => {
  it.each(["male", "female"] as const)(
    "covers every mensuration exactly once for %s",
    (sex) => {
      const kinds = SILHOUETTES[sex].zones.map((zone) => zone.kind);

      expect(kinds.slice().sort()).toEqual(MENSURATION_KINDS.slice().sort());
    },
  );

  it.each(["male", "female"] as const)(
    "keeps every %s line inside the drawing",
    (sex) => {
      for (const zone of SILHOUETTES[sex].zones) {
        expect(zone.y).toBeGreaterThan(0);
        expect(zone.y).toBeLessThan(SILHOUETTE_VIEWBOX_HEIGHT);
      }
    },
  );

  // The two bodies are drawn to different proportions. A shared table
  // would put the woman's hips label 35 viewBox units below her hips.
  it("gives the two silhouettes different coordinates", () => {
    for (const kind of MENSURATION_KINDS) {
      const male = SILHOUETTES.male.zones.find((z) => z.kind === kind)!;
      const female = SILHOUETTES.female.zones.find((z) => z.kind === kind)!;

      expect(male.y).not.toBe(female.y);
    }
  });

  // The label can only be read on the side the drawing's own line
  // reaches: the biceps line stops on the right arm, the thigh and calf
  // lines run down the left leg.
  it("puts the arm zone right and the leg zones left, on both drawings", () => {
    for (const sex of ["male", "female"] as const) {
      const side = (kind: string) =>
        SILHOUETTES[sex].zones.find((z) => z.kind === kind)!.side;

      expect(side("biceps_cm")).toBe("right");
      expect(side("thigh_cm")).toBe("left");
      expect(side("calf_cm")).toBe("left");
    }
  });
});

describe("lineTopPx", () => {
  it("places a line proportionally to the rendered height, not in fixed px", () => {
    const at380 = lineTopPx(604, { imageHeight: 380, imageTop: 0 });
    const at760 = lineTopPx(604, { imageHeight: 760, imageTop: 0 });

    // 604 is exactly half the viewBox.
    expect(at380).toBeCloseTo(190);
    expect(at760).toBeCloseTo(380);
  });

  it("offsets by the drawing's own top edge", () => {
    expect(lineTopPx(0, { imageHeight: 380, imageTop: 8 })).toBe(8);
  });
});

describe("spreadColumn", () => {
  const options = {
    labelHeight: PLACEMENT.labelHeight,
    minGap: PLACEMENT.minGap,
    panelHeight: PLACEMENT.panelHeight,
  };

  it("leaves labels exactly where they asked to be when nothing collides", () => {
    expect(spreadColumn([0, 100, 200], options)).toEqual([0, 100, 200]);
  });

  // The point of pooling rather than pushing: a colliding pair is split
  // apart around where it wanted to be, instead of the first staying put
  // and the second wearing the whole error. Fixtures sit away from the
  // panel edges on purpose — the clamps at the end of spreadColumn have
  // their own tests, and would mask this one.
  it("shares the displacement between two colliding labels", () => {
    expect(spreadColumn([100, 110], options)).toEqual([75, 135]);
  });

  it("moves both by the same amount, in opposite directions", () => {
    const [first, second] = spreadColumn([100, 110], options);

    expect(100 - first!).toBeCloseTo(second! - 110);
  });

  it("pools a whole run of collisions into one evenly spaced block", () => {
    expect(spreadColumn([100, 110, 120], options)).toEqual([50, 110, 170]);
  });

  // Pushing down can run the column off the bottom; lifting it back by
  // the overflow keeps every gap intact, because a uniform shift changes
  // no distance between two labels.
  it("lifts the whole column back when pushing down overflows the panel", () => {
    const tops = spreadColumn([200, 210, 220], options);

    expect(Math.max(...tops) + options.labelHeight).toBeLessThanOrEqual(
      options.panelHeight,
    );
    for (let i = 1; i < tops.length; i += 1) {
      expect(tops[i]! - tops[i - 1]!).toBe(60);
    }
  });

  it("never places a label above the panel's own top edge", () => {
    expect(spreadColumn([-40, -30], options)[0]).toBe(0);
  });

  it("handles an empty column", () => {
    expect(spreadColumn([], options)).toEqual([]);
  });
});

describe("placeZones", () => {
  it.each(["male", "female"] as const)(
    "never overlaps two labels in the same column for %s",
    (sex) => {
      const placed = placeZones(SILHOUETTES[sex], PLACEMENT);

      for (const side of ["left", "right"] as const) {
        const tops = placed
          .filter((zone) => zone.side === side)
          .map((zone) => zone.labelTop)
          .sort((a, b) => a - b);

        for (let i = 1; i < tops.length; i += 1) {
          expect(tops[i]! - tops[i - 1]!).toBeGreaterThanOrEqual(
            PLACEMENT.labelHeight,
          );
        }
      }
    },
  );

  it.each(["male", "female"] as const)(
    "keeps every %s label inside the panel",
    (sex) => {
      for (const zone of placeZones(SILHOUETTES[sex], PLACEMENT)) {
        expect(zone.labelTop).toBeGreaterThanOrEqual(0);
        expect(zone.labelTop + PLACEMENT.labelHeight).toBeLessThanOrEqual(
          PLACEMENT.panelHeight,
        );
      }
    },
  );

  // The reason a small displacement is acceptable: the line the label
  // belongs to still runs THROUGH the label's own box, so it never
  // points at the gap between two of them.
  it.each(["male", "female"] as const)(
    "keeps each %s line inside the box of the label it belongs to",
    (sex) => {
      for (const zone of placeZones(SILHOUETTES[sex], PLACEMENT)) {
        expect(zone.lineTop).toBeGreaterThanOrEqual(zone.labelTop);
        expect(zone.lineTop).toBeLessThanOrEqual(
          zone.labelTop + PLACEMENT.labelHeight,
        );
      }
    },
  );

  it("follows the drawing when it is rendered at a different height", () => {
    const small = placeZones(SILHOUETTES.male, PLACEMENT);
    const large = placeZones(SILHOUETTES.male, {
      ...PLACEMENT,
      imageHeight: 760,
      panelHeight: 800,
    });

    const hipsLine = (zones: typeof small) =>
      zones.find((zone) => zone.kind === "hips_cm")!.lineTop;

    expect(hipsLine(large)).toBeGreaterThan(hipsLine(small));
  });
});
