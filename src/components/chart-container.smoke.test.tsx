import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Line, LineChart } from "recharts";
import { ChartContainer } from "@/components/ui/chart";

// Plan s07 task 1, ADR 017: the named trap this test exists to catch is
// that a bare `<ResponsiveContainer>` renders an empty <div> under jsdom
// WITHOUT throwing — jsdom has neither ResizeObserver nor a real layout
// engine, so a naive smoke test asserting "no crash" would pass on a
// chart that renders nothing at all. shadcn's ChartContainer works
// around this with `initialDimension={{ width: 320, height: 200 }}`
// (verified in the installed registry file, chart.tsx:12): this test
// locks that the workaround actually produces a real <svg> with content,
// not just a non-throwing empty wrapper. Every chart test in this story
// renders through ChartContainer for exactly this reason — never a bare
// ResponsiveContainer.
describe("ChartContainer — renders a real, non-empty SVG under jsdom", () => {
  it("produces an <svg> containing a <path> for a minimal line chart", () => {
    const data = [
      { t: 1, value: 10 },
      { t: 2, value: 20 },
    ];

    const { container } = render(
      <ChartContainer config={{ value: { label: "Test", color: "red" } }}>
        <LineChart data={data}>
          <Line dataKey="value" />
        </LineChart>
      </ChartContainer>,
    );

    const svg = container.querySelector("svg.recharts-surface");
    expect(svg).not.toBeNull();
    expect(svg?.querySelector(".recharts-line-curve")).not.toBeNull();
  });
});
