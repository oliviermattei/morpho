import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BodyMapLegend } from "./BodyMapLegend";

// Plan s06 task 5: the legend is the third non-chromatic carrier of the
// verdict (alongside the delta's own sign and the glyph itself) — a
// reader who can't perceive the fill color still learns what ▲/▼ mean.
describe("BodyMapLegend", () => {
  it("explains the favorable glyph", () => {
    render(<BodyMapLegend />);

    expect(screen.getByText("▲")).toBeInTheDocument();
    expect(screen.getByText(/progrès/)).toBeInTheDocument();
  });

  it("explains the adverse glyph", () => {
    render(<BodyMapLegend />);

    expect(screen.getByText("▼")).toBeInTheDocument();
    expect(screen.getByText(/recul/)).toBeInTheDocument();
  });

  it("states the delta is measured from the first recorded session", () => {
    render(<BodyMapLegend />);

    expect(screen.getByText(/depuis la 1/)).toBeInTheDocument();
    expect(screen.getByText(/mesure/)).toBeInTheDocument();
  });

  it("colors the favorable glyph with the progress-favorable token, never a literal color", () => {
    const { container } = render(<BodyMapLegend />);

    const favorableGlyph = screen.getByText("▲");
    expect(favorableGlyph.className).toMatch(/\btext-progress-favorable\b/);
    const adverseGlyph = screen.getByText("▼");
    expect(adverseGlyph.className).toMatch(/\btext-progress-adverse\b/);
    void container;
  });

  it("reads at text-label-min, the silhouette's own label floor", () => {
    render(<BodyMapLegend />);

    expect(screen.getByText(/progrès/).closest("p")?.className).toMatch(
      /\btext-label-min\b/,
    );
  });
});
