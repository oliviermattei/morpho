"use client";

import { Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatAxisDate, formatFullDate } from "@/lib/date";
import { formatMeasurementValue } from "@/lib/measurements";
import type { SeriesPoint } from "@/lib/measurement-series";
import { weightChartDomain } from "@/lib/target-weight";

export interface MeasurementChartProps {
  series: SeriesPoint[];
  seriesLabel: string;
  formatValue: (value: number) => string;
  // s08 task 7, decision 18: a single optional prop, added directly to
  // this existing component — no fork, no wrapper. `null` (the default)
  // renders exactly s07's chart, byte for byte; the caller
  // (MeasurementChartsPanel) only ever passes a non-null value when the
  // weight measure is selected (criterion 5 — never on any other kind,
  // never on the IMC derived from it).
  targetWeightKg?: number | null;
}

// Decision 21: the label sits above the line by default (verticalAnchor
// "end" for a horizontal ReferenceLine's insideBottomLeft), and flips
// below it (insideTopLeft) once the target sits in the domain's top
// quarter, so the text never collides with the plot's ceiling.
function referenceLinePosition(
  targetKg: number,
  domain: [number, number] | undefined,
): "insideBottomLeft" | "insideTopLeft" {
  if (!domain) return "insideBottomLeft";
  const [lo, hi] = domain;
  const range = hi - lo;
  if (range <= 0) return "insideBottomLeft";
  const fraction = (targetKg - lo) / range;
  return fraction >= 0.75 ? "insideTopLeft" : "insideBottomLeft";
}

/**
 * The single Recharts boundary in this app (plan s07 task 5, ADR 017) —
 * "use client" so this is the only chunk that pulls Recharts's runtime
 * dependency tree into a bundle. One component, exported once, extended
 * only by optional props (plan P3): s08's task 7 adds `targetWeightKg`
 * here directly rather than forking or wrapping this file.
 *
 * Every axis prop below is explicit, never left to a Recharts default —
 * the defaults verified against the installed recharts@3.8.0 sources
 * (ADR 017) are wrong for this screen on purpose (a numeric domain
 * anchored at 0, a category-shaped X axis without `dataKey`).
 */
export function MeasurementChart({
  series,
  seriesLabel,
  formatValue,
  targetWeightKg = null,
}: MeasurementChartProps) {
  const config: ChartConfig = {
    value: { label: seriesLabel, color: "var(--foreground)" },
  };

  // P8/decision 20: s07's own ['auto','auto'] default stays untouched
  // unless a target is present — weightChartDomain folds the target
  // into the domain so ReferenceLine's ifOverflow: 'discard' default
  // never silently drops it (trap 1).
  const computedTargetDomain =
    targetWeightKg !== null
      ? weightChartDomain(
          series.map((point) => point.value),
          targetWeightKg,
        )
      : undefined;
  const yAxisDomain: [string, string] | [number, number] =
    computedTargetDomain ?? ["auto", "auto"];

  return (
    <ChartContainer config={config}>
      <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        {/*
          P9: dataKey="t" is not optional decoration — without it,
          Recharts's getValueByDataKey(entry, undefined) resolves to
          undefined for every point, and every line point ends up with
          x: null (criterion 2 breaks silently, no error).
          type="number" + scale="time" + domain={["dataMin","dataMax"]}
          is what makes the axis a REAL temporal axis: two sessions a
          month apart sit proportionally farther apart than two sessions
          a day apart, unlike the equal spacing a categorical axis would
          produce (the story's first named trap).
        */}
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={formatAxisDate}
          interval="preserveStartEnd"
          minTickGap={48}
        />
        {/*
          P8: recharts@3.8.0's numeric domain defaults to [0, 'auto'] —
          verified in the installed source (ADR 017) — which would flatten
          a 74-78kg series into a hairline at the top of the plot.
          ['auto', 'auto'] never anchors at zero. tickCount defaults to 5;
          the design asks for 3.
        */}
        <YAxis width="auto" domain={yAxisDomain} tickCount={3} />
        <ChartTooltip
          trigger="click"
          content={
            <ChartTooltipContent
              // R3: on a type="number" XAxis, ChartTooltipContent's first
              // argument is NOT the axis value — it's the series name
              // ("Poids"), read from itemConfig.label because
              // `typeof label === "string"` never holds for a numeric
              // axis. The real timestamp lives in the payload's own
              // data point. Never render anything without it — that is
              // exactly the guard that keeps this from ever calling
              // formatFullDate(NaN) and throwing on a tap.
              labelFormatter={(_, payload) => {
                const point = payload?.[0]?.payload as
                  | SeriesPoint
                  | undefined;
                if (point?.t === undefined) return null;
                return formatFullDate(point.t);
              }}
              // R3's corollary: formatter and the default "name + value"
              // block are the two branches of one ternary in
              // ChartTooltipContent — supplying a formatter without
              // rendering the name here would silently drop the measure
              // name the design requires.
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">{name}</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatValue(value as number)}
                  </span>
                </div>
              )}
            />
          }
        />
        {/*
          P6: connectNulls is never passed. The series never contains a
          null value in the first place (buildSeries only emits points
          for measurements actually recorded), so there is nothing to
          bridge — the design's "raccord entre points connus" is already
          true by construction of the data, not by a Recharts prop.
          dot stays at its own default (true): every real measurement is
          a tappable point (criterion 6).
        */}
        <Line
          dataKey="value"
          name={seriesLabel}
          type="monotone"
          stroke="var(--color-value)"
          dot
        />
        {/*
          s08 task 7: the target weight reference line — a dashed,
          thinner, point-less line so it's distinct from the measure's
          own curve by shape alone, not just color (design system
          §Graphes). Two traps in Recharts's own defaults, both named in
          the plan: `stroke` defaults to "#ccc" (which ChartContainer's
          own CSS would otherwise silently redirect to --border), and a
          string `label` falls back to Text's DEFAULT_FILL = "#808080" —
          neither is a token. The object form of `label` is required to
          reach `fill`/`className` at all (Label.js only spreads an
          object label's own props); a bare string label ignores both.
        */}
        {targetWeightKg !== null && (
          <ReferenceLine
            y={targetWeightKg}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            ifOverflow="discard"
            label={{
              value: `Cible ${formatMeasurementValue(targetWeightKg, "kg")}`,
              position: referenceLinePosition(
                targetWeightKg,
                computedTargetDomain,
              ),
              fill: "var(--muted-foreground)",
              className: "recharts-label text-label-min",
            }}
          />
        )}
      </LineChart>
    </ChartContainer>
  );
}
