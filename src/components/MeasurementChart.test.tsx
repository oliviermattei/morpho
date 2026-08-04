import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MeasurementChart } from "./MeasurementChart";
import { formatMeasurementValue } from "@/lib/measurements";

const formatKg = (value: number) => formatMeasurementValue(value, "kg");

// (a) Positive assertion first, always — a test asserting "no phantom
// point" that ran against an empty render would pass for the wrong
// reason (plan's own warning, task 5 and test strategy).
describe("MeasurementChart — renders a real SVG line with one dot per point", () => {
  it("renders as many .recharts-line-dot as there are points", () => {
    const series = [
      { t: Date.UTC(2026, 0, 1), value: 74 },
      { t: Date.UTC(2026, 0, 2), value: 75 },
      { t: Date.UTC(2026, 2, 1), value: 78 },
    ];

    const { container } = render(
      <MeasurementChart series={series} seriesLabel="Poids" formatValue={formatKg} />,
    );

    const svg = container.querySelector("svg.recharts-surface");
    expect(svg).not.toBeNull();
    expect(container.querySelectorAll(".recharts-line-dot")).toHaveLength(3);
  });
});

// (b) Criterion 2 — a real temporal axis, not a categorical one. Jan 1,
// Jan 2, Mar 1: the gap between the 2nd and 3rd point is far larger than
// between the 1st and 2nd. A categorical axis would space all three
// equally (ratio 0.5); a real time axis must not.
describe("MeasurementChart — criterion 2: a real temporal axis, not categorical spacing", () => {
  it("spaces points proportionally to the real interval between their dates", () => {
    const series = [
      { t: Date.UTC(2026, 0, 1), value: 70 },
      { t: Date.UTC(2026, 0, 2), value: 71 },
      { t: Date.UTC(2026, 2, 1), value: 72 },
    ];

    const { container } = render(
      <MeasurementChart series={series} seriesLabel="Poids" formatValue={formatKg} />,
    );

    const dots = Array.from(container.querySelectorAll(".recharts-line-dot"));
    expect(dots).toHaveLength(3);
    const cx = dots.map((dot) => Number(dot.getAttribute("cx")));

    const ratio = (cx[1]! - cx[0]!) / (cx[2]! - cx[0]!);
    // A categorical axis would put this exactly at 0.5 (equal spacing).
    // The real interval (1 day out of ~59 days) is nowhere near that.
    expect(ratio).toBeLessThan(0.1);
  });
});

// (c) Criterion 5 — a single point must not crash the render, and the
// (possibly absent) curve path is tolerated rather than required.
describe("MeasurementChart — criterion 5: a single point renders without crashing", () => {
  it("renders exactly one dot and does not throw", () => {
    const series = [{ t: Date.UTC(2026, 0, 1), value: 74 }];

    expect(() =>
      render(<MeasurementChart series={series} seriesLabel="Poids" formatValue={formatKg} />),
    ).not.toThrow();

    // .recharts-line-curve may or may not carry a `d` attribute for a
    // single point — its presence is not asserted, only that nothing
    // crashed and the point itself rendered.
  });

  it("renders the one dot", () => {
    const series = [{ t: Date.UTC(2026, 0, 1), value: 74 }];

    const { container } = render(
      <MeasurementChart series={series} seriesLabel="Poids" formatValue={formatKg} />,
    );

    expect(container.querySelectorAll(".recharts-line-dot")).toHaveLength(1);
  });
});

// (d) No raw epoch (13-digit millisecond number) ever leaks onto an
// axis tick — every tick must go through formatAxisDate.
describe("MeasurementChart — axis ticks are formatted dates, never a raw epoch", () => {
  it("contains no 13-digit number anywhere in the rendered tick text", () => {
    const series = [
      { t: Date.UTC(2026, 0, 1), value: 74 },
      { t: Date.UTC(2026, 2, 1), value: 78 },
    ];

    const { container } = render(
      <MeasurementChart series={series} seriesLabel="Poids" formatValue={formatKg} />,
    );

    const tickTexts = Array.from(
      container.querySelectorAll(".recharts-cartesian-axis-tick-value"),
    ).map((node) => node.textContent ?? "");

    for (const text of tickTexts) {
      expect(text).not.toMatch(/\d{13}/);
    }
  });
});

// (e) P8 — the Y axis is never anchored to zero on a series that
// doesn't need it.
describe("MeasurementChart — Y axis is never anchored to zero (P8)", () => {
  it("no Y axis tick reads 0 for a 74-78 series, and the lowest tick sits near 74", () => {
    const series = [
      { t: Date.UTC(2026, 0, 1), value: 74 },
      { t: Date.UTC(2026, 1, 1), value: 76 },
      { t: Date.UTC(2026, 2, 1), value: 78 },
    ];

    const { container } = render(
      <MeasurementChart series={series} seriesLabel="Poids" formatValue={formatKg} />,
    );

    // Recharts renders every axis's tick labels in their own
    // `.recharts-{axis}-tick-labels` group, a sibling of the axis's own
    // line/tick-line group — not nested inside it.
    const yAxisTicks = Array.from(
      container.querySelectorAll(
        ".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value",
      ),
    ).map((node) => Number(node.textContent));

    expect(yAxisTicks.length).toBeGreaterThan(0);
    expect(yAxisTicks).not.toContain(0);
    expect(Math.min(...yAxisTicks)).toBeGreaterThan(70);
  });
});

// (g) No hard-coded color anywhere in the line's own stroke — it must
// read the design system token through ChartContainer's config, never
// Recharts's own #3182bd default.
describe("MeasurementChart — the line's stroke is the design token, never Recharts's default", () => {
  it("the line curve's stroke is var(--color-value), not #3182bd", () => {
    const series = [
      { t: Date.UTC(2026, 0, 1), value: 74 },
      { t: Date.UTC(2026, 1, 1), value: 78 },
    ];

    const { container } = render(
      <MeasurementChart series={series} seriesLabel="Poids" formatValue={formatKg} />,
    );

    const curve = container.querySelector(".recharts-line-curve");
    expect(curve).not.toBeNull();
    expect(curve?.getAttribute("stroke")).toBe("var(--color-value)");
    expect(curve?.getAttribute("stroke")).not.toBe("#3182bd");
  });
});

// s08 task 7: the target weight reference line, added directly to
// MeasurementChart via an optional prop (decision 18) — no fork, no
// wrapper component.
describe("MeasurementChart — target weight reference line (s08 task 7)", () => {
  it("renders the line even with a target FAR OUTSIDE the measured range (the case ifOverflow: discard would otherwise hide)", () => {
    const series = [
      { t: Date.UTC(2026, 0, 1), value: 74 },
      { t: Date.UTC(2026, 1, 1), value: 76 },
    ];

    const { container } = render(
      <MeasurementChart
        series={series}
        seriesLabel="Poids"
        formatValue={formatKg}
        targetWeightKg={50}
      />,
    );

    expect(container.querySelector(".recharts-reference-line")).not.toBeNull();
  });

  it("the line's stroke is the muted-foreground token, never Recharts's #ccc default", () => {
    const series = [
      { t: Date.UTC(2026, 0, 1), value: 74 },
      { t: Date.UTC(2026, 1, 1), value: 76 },
    ];

    const { container } = render(
      <MeasurementChart
        series={series}
        seriesLabel="Poids"
        formatValue={formatKg}
        targetWeightKg={72}
      />,
    );

    const line = container.querySelector(".recharts-reference-line-line");
    expect(line).not.toBeNull();
    expect(line?.getAttribute("stroke")).toBe("var(--muted-foreground)");
    expect(line?.getAttribute("stroke")).not.toBe("#ccc");
  });

  it("the label's fill is the token, never absent and never Recharts's #808080 default", () => {
    const series = [
      { t: Date.UTC(2026, 0, 1), value: 74 },
      { t: Date.UTC(2026, 1, 1), value: 76 },
    ];

    const { container } = render(
      <MeasurementChart
        series={series}
        seriesLabel="Poids"
        formatValue={formatKg}
        targetWeightKg={72}
      />,
    );

    // The reference line's label is NOT nested under
    // .recharts-reference-line in the DOM — Recharts renders every
    // label as a sibling <text>, positioned absolutely by its own x/y
    // (same motif as the axis tick labels in a separate layer from
    // their tick lines). .recharts-label is unique to this component.
    const label = container.querySelector("text.recharts-label");
    expect(label).not.toBeNull();
    expect(label?.getAttribute("fill")).toBe("var(--muted-foreground)");
    expect(label?.getAttribute("fill")).not.toBe("#808080");
  });

  it("the label's class always contains recharts-label and text-label-min", () => {
    const series = [
      { t: Date.UTC(2026, 0, 1), value: 74 },
      { t: Date.UTC(2026, 1, 1), value: 76 },
    ];

    const { container } = render(
      <MeasurementChart
        series={series}
        seriesLabel="Poids"
        formatValue={formatKg}
        targetWeightKg={72}
      />,
    );

    const label = container.querySelector("text.recharts-label");
    expect(label?.getAttribute("class")).toContain("recharts-label");
    expect(label?.getAttribute("class")).toContain("text-label-min");
  });

  it('the label reads "Cible 72 kg"', () => {
    const series = [
      { t: Date.UTC(2026, 0, 1), value: 74 },
      { t: Date.UTC(2026, 1, 1), value: 76 },
    ];

    render(
      <MeasurementChart
        series={series}
        seriesLabel="Poids"
        formatValue={formatKg}
        targetWeightKg={72}
      />,
    );

    expect(screen.getByText("Cible 72 kg")).toBeInTheDocument();
  });

  it("renders no reference line at all when targetWeightKg is null", () => {
    const series = [
      { t: Date.UTC(2026, 0, 1), value: 74 },
      { t: Date.UTC(2026, 1, 1), value: 76 },
    ];

    const { container } = render(
      <MeasurementChart
        series={series}
        seriesLabel="Poids"
        formatValue={formatKg}
        targetWeightKg={null}
      />,
    );

    expect(container.querySelector(".recharts-reference-line")).toBeNull();
  });

  // Decision 21: a target in the domain's top quarter must not have its
  // label collide with the plot's ceiling — position flips to
  // insideTopLeft (text below the line) instead of the default
  // insideBottomLeft (text above it).
  it("flips the label position to insideTopLeft when the target sits in the domain's top quarter", () => {
    // Series 70-71, target 72: weightChartDomain([70,71,72]) with a 1kg
    // margin -> [69, 73], a 4kg span. The target (72) sits at (72-69)/4 =
    // 0.75 -> exactly the top quarter boundary.
    const series = [
      { t: Date.UTC(2026, 0, 1), value: 70 },
      { t: Date.UTC(2026, 1, 1), value: 71 },
    ];

    const { container } = render(
      <MeasurementChart
        series={series}
        seriesLabel="Poids"
        formatValue={formatKg}
        targetWeightKg={72}
      />,
    );

    // Recharts's Text component encodes the vertical anchor as the
    // first tspan's `dy`, not textAnchor (which stays "start" for both
    // insideTopLeft and insideBottomLeft — "Left" is the horizontal
    // half of the position name). verticalAnchor "start" (insideTopLeft)
    // renders dy = capHeight ("0.71em", Text.js's own default);
    // verticalAnchor "end" (insideBottomLeft, the default case) renders
    // dy = "0em" for a single-line label — confirmed by rendering the
    // default case below and reading its own dy.
    const label = container.querySelector("text.recharts-label tspan");
    expect(label?.getAttribute("dy")).toBe("0.71em");
  });

  it("keeps the default insideBottomLeft position (dy 0em) when the target sits in the lower part of the domain", () => {
    const series = [
      { t: Date.UTC(2026, 0, 1), value: 74 },
      { t: Date.UTC(2026, 1, 1), value: 76 },
    ];

    const { container } = render(
      <MeasurementChart
        series={series}
        seriesLabel="Poids"
        formatValue={formatKg}
        targetWeightKg={70}
      />,
    );

    const label = container.querySelector("text.recharts-label tspan");
    expect(label?.getAttribute("dy")).toBe("0em");
  });
});

// (f) The tooltip: tapping/clicking a point must reveal the full date,
// the measure's name, and its formatted value — and must never throw
// (R3's named bug: labelFormatter receiving the series name instead of
// the timestamp, producing new Date("Poids") -> RangeError).
describe("MeasurementChart — tooltip content on a tapped point (criterion 6, R3)", () => {
  it("clicking near a point reveals its full date, the measure name and its formatted value, without throwing", () => {
    const series = [
      { t: Date.UTC(2026, 0, 26), value: 77.2 },
      { t: Date.UTC(2026, 2, 1), value: 78 },
    ];

    const { container } = render(
      <MeasurementChart series={series} seriesLabel="Poids" formatValue={formatKg} />,
    );

    const wrapper = container.querySelector(".recharts-wrapper");
    expect(wrapper).not.toBeNull();

    const firstDot = container.querySelector(".recharts-line-dot");
    const cx = Number(firstDot?.getAttribute("cx"));
    const cy = Number(firstDot?.getAttribute("cy"));

    expect(() =>
      fireEvent.click(wrapper as Element, { clientX: cx, clientY: cy }),
    ).not.toThrow();

    expect(screen.getByText("26 janvier 2026")).toBeInTheDocument();
    expect(screen.getByText("Poids")).toBeInTheDocument();
    expect(screen.getByText(formatKg(77.2))).toBeInTheDocument();
  });
});
