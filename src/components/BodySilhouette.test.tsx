import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BodySilhouette } from "./BodySilhouette";
import type { BodyMapView } from "@/lib/body-map-view";

const EMPTY_VIEW: BodyMapView = {
  measurements: {},
  bmi: { state: "none", valueText: null, deltaText: null, verdict: null },
};

const VIEW_WITH_WAIST: BodyMapView = {
  measurements: {
    waist_cm: {
      state: "compared",
      valueText: "88,6 cm",
      deltaText: "−7,4 cm",
      verdict: "favorable",
    },
  },
  bmi: { state: "none", valueText: null, deltaText: null, verdict: null },
};

// Labels come from the catalog (src/lib/measurements.ts), never
// redeclared per screen.
const ZONE_NAMES = [
  "Épaules",
  "Poitrine",
  "Hanches",
  "Mollet",
  "Biceps",
  "Taille",
  "Cuisse",
];

describe("BodySilhouette", () => {
  it.each(["male", "female"] as const)(
    "draws the %s silhouette from its own asset",
    (sex) => {
      const { container } = render(
        <BodySilhouette view={EMPTY_VIEW} sex={sex} />,
      );

      const image = container.querySelector("img");
      expect(image).toHaveAttribute(
        "src",
        sex === "male" ? "/silhouettes/man.svg" : "/silhouettes/woman.svg",
      );
      // The drawing carries no information the labels don't — screen
      // readers must not hear "silhouette" seven times.
      expect(image).toHaveAttribute("aria-hidden", "true");
      expect(image).toHaveAttribute("alt", "");
    },
  );

  it("labels the 7 tracked zones", () => {
    render(<BodySilhouette view={EMPTY_VIEW} sex="male" />);

    for (const name of ZONE_NAMES) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("shows an em dash and 'Aucune mesure' for a zone with no value", () => {
    render(<BodySilhouette view={EMPTY_VIEW} sex="male" />);

    expect(screen.getAllByText("—")).toHaveLength(ZONE_NAMES.length);
    expect(screen.getAllByText("Aucune mesure")).toHaveLength(
      ZONE_NAMES.length,
    );
  });

  it("renders a zone's value and its signed delta, coloured by verdict", () => {
    const { container } = render(
      <BodySilhouette view={VIEW_WITH_WAIST} sex="male" />,
    );

    expect(screen.getByText("88,6 cm")).toBeInTheDocument();
    const deltaLine = container.querySelector(
      '[data-zone-third-line].text-progress-favorable',
    );
    expect(deltaLine?.textContent).toBe("−7,4 cm");
  });

  // The dashed lines now live in man.svg / woman.svg. Drawing them here
  // too would double every one of them.
  it("draws no leader line of its own — the SVG carries them", () => {
    const { container } = render(
      <BodySilhouette view={EMPTY_VIEW} sex="male" />,
    );

    expect(container.querySelectorAll(".border-dashed")).toHaveLength(0);
  });

  // The female drawing's hips and calves sit lower than the male one's.
  // Sharing one table would float those two labels off the body they
  // point at, which is invisible in a snapshot but wrong on screen.
  it("positions the hips label differently for each silhouette", () => {
    const male = render(<BodySilhouette view={EMPTY_VIEW} sex="male" />);
    const maleTop = male.getByText("Hanches").parentElement?.getAttribute("style");
    male.unmount();

    const female = render(<BodySilhouette view={EMPTY_VIEW} sex="female" />);
    const femaleTop = female
      .getByText("Hanches")
      .parentElement?.getAttribute("style");

    expect(maleTop).not.toBe(femaleTop);
  });

  // The whole point of the spreading pass. Two labels that overlap are
  // two unreadable labels, and the drawing puts some of these lines only
  // 22px apart.
  it.each(["male", "female"] as const)(
    "never lets two %s labels overlap in the same column",
    (sex) => {
      const { container } = render(<BodySilhouette view={EMPTY_VIEW} sex={sex} />);

      const boxes = Array.from(
        container.querySelectorAll<HTMLElement>("[data-zone-label]"),
      ).map((node) => ({
        side: node.className.includes("left-0") ? "left" : "right",
        top: Number.parseFloat(node.style.top),
      }));

      for (const side of ["left", "right"]) {
        const tops = boxes
          .filter((box) => box.side === side)
          .map((box) => box.top)
          .sort((a, b) => a - b);

        for (let i = 1; i < tops.length; i += 1) {
          expect(tops[i]! - tops[i - 1]!).toBeGreaterThanOrEqual(56);
        }
      }
    },
  );
});
