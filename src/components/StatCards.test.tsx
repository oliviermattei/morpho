import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCards } from "./StatCards";
import type { BodyMapView, ViewEntry } from "@/lib/body-map-view";

const NONE: ViewEntry = {
  state: "none",
  valueText: null,
  deltaText: null,
  verdict: null,
};

function view(overrides: Partial<BodyMapView["measurements"]> = {}, bmi = NONE) {
  return { measurements: overrides, bmi } as BodyMapView;
}

describe("StatCards", () => {
  it("renders the four off-body measures", () => {
    render(<StatCards view={view()} />);

    for (const label of ["Poids", "IMC", "Masse grasse", "Masse musculaire"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("shows an em dash and the state line when a measure has no value", () => {
    render(<StatCards view={view()} />);

    expect(screen.getAllByText("—")).toHaveLength(4);
    expect(screen.getAllByText("Aucune mesure")).toHaveLength(4);
  });

  it("renders a tinted pill with the glyph and the delta for a favorable move", () => {
    const { container } = render(
      <StatCards
        view={view({
          weight_kg: {
            state: "compared",
            valueText: "82,4 kg",
            deltaText: "−3,2 kg",
            verdict: "favorable",
          },
        })}
      />,
    );

    expect(screen.getByText("82,4 kg")).toBeInTheDocument();
    const pill = container.querySelector("[data-delta-pill]");
    expect(pill?.textContent).toBe("▲ −3,2 kg");
    expect(pill?.className).toContain("text-progress-favorable");
  });

  it("tints an adverse move differently", () => {
    const { container } = render(
      <StatCards
        view={view({
          body_fat_pct: {
            state: "compared",
            valueText: "24,8 %",
            deltaText: "+2,1 pts",
            verdict: "adverse",
          },
        })}
      />,
    );

    const pill = container.querySelector("[data-delta-pill]");
    expect(pill?.textContent).toBe("▼ +2,1 pts");
    expect(pill?.className).toContain("text-progress-adverse");
  });

  // "1 mesure" and "Aucune mesure" are states, not progress. A pill
  // around them would read as an achievement.
  it("does not render a pill for a state line", () => {
    const { container } = render(
      <StatCards
        view={view({
          weight_kg: {
            state: "single",
            valueText: "82,4 kg",
            deltaText: null,
            verdict: null,
          },
        })}
      />,
    );

    expect(screen.getByText("1 mesure")).toBeInTheDocument();
    expect(container.querySelector("[data-delta-pill]")).toBeNull();
  });

  // The IMC is never favorable/adverse (body-map-view decision 5) — it
  // gets a neutral pill, never a green or red one.
  it("renders the IMC's delta without a progress colour", () => {
    const { container } = render(
      <StatCards
        view={view(
          {},
          {
            state: "compared",
            valueText: "26,1",
            deltaText: "−1,0",
            verdict: "neutral",
          },
        )}
      />,
    );

    const pill = container.querySelector("[data-delta-pill]");
    expect(pill?.textContent).toBe("−1,0");
    expect(pill?.className).not.toContain("text-progress-favorable");
    expect(pill?.className).not.toContain("text-progress-adverse");
  });
});
