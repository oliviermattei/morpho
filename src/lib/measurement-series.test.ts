// @vitest-environment node
//
// Plan s07 task 2 — the pure core of criterion 3. This is where "empty is
// not zero" actually gets enforced for the chart: buildSeries never turns
// a missing measurement into a 0, a null point, or a silently-interpolated
// value. Recharts itself behaves correctly given clean input — the risk
// lives entirely in the data preparation this file owns.
import { describe, expect, it } from "vitest";
import {
  buildSeries,
  MeasurementSeriesContractError,
  type RawSeriesRow,
} from "./measurement-series";

function row(overrides: Partial<RawSeriesRow>): RawSeriesRow {
  return {
    kind: "weight_kg",
    measuredOn: "2026-01-26",
    value: 74,
    createdAt: new Date("2026-01-26T10:00:00Z"),
    ...overrides,
  };
}

describe("buildSeries — invariant (a): a missing measurement produces no point", () => {
  it("returns an empty array when no row carries the requested kind", () => {
    const rows: RawSeriesRow[] = [row({ kind: "biceps_cm" })];

    expect(buildSeries(rows, "weight_kg")).toEqual([]);
  });

  it("never fabricates a 0, a null point, or an entry for a kind it wasn't given", () => {
    const rows: RawSeriesRow[] = [
      row({ kind: "weight_kg", measuredOn: "2026-01-01", value: 74 }),
      row({ kind: "biceps_cm", measuredOn: "2026-01-02", value: 34 }),
    ];

    const series = buildSeries(rows, "weight_kg");

    expect(series).toHaveLength(1);
    expect(series.some((point) => point.value === 0)).toBe(false);
  });

  it("out of 7 sessions, only the 4 that actually carry the measurement produce a point", () => {
    const carryingDates = [
      "2026-01-01",
      "2026-01-05",
      "2026-02-01",
      "2026-03-01",
    ];
    const otherKindDates = ["2026-01-10", "2026-01-20", "2026-02-15"];
    const rows: RawSeriesRow[] = [
      ...carryingDates.map((measuredOn) =>
        row({ kind: "weight_kg", measuredOn }),
      ),
      ...otherKindDates.map((measuredOn) =>
        row({ kind: "chest_cm", measuredOn }),
      ),
    ];

    expect(buildSeries(rows, "weight_kg")).toHaveLength(4);
  });

  it("a single recorded measurement produces exactly one point", () => {
    const rows: RawSeriesRow[] = [row({})];

    expect(buildSeries(rows, "weight_kg")).toHaveLength(1);
  });

  it("no rows at all produces an empty array", () => {
    expect(buildSeries([], "weight_kg")).toEqual([]);
  });
});

describe("buildSeries — invariant (b): a value arriving as a string is a contract error, not a silent pass-through", () => {
  it("throws MeasurementSeriesContractError, distinct from a generic Error, on a string value", () => {
    const rows: RawSeriesRow[] = [row({ value: "72.40" as unknown as number })];

    expect(() => buildSeries(rows, "weight_kg")).toThrow(
      MeasurementSeriesContractError,
    );
  });

  it("throws on a non-finite value (NaN, Infinity) rather than plotting it", () => {
    const rows: RawSeriesRow[] = [row({ value: Number.NaN })];

    expect(() => buildSeries(rows, "weight_kg")).toThrow(
      MeasurementSeriesContractError,
    );
  });
});

describe("buildSeries — invariant (c): same-date sessions are deduplicated, most recently created wins (R1)", () => {
  it("keeps the value from the row with the later createdAt when two rows share a date", () => {
    const rows: RawSeriesRow[] = [
      row({
        measuredOn: "2026-01-26",
        value: 74,
        createdAt: new Date("2026-01-26T08:00:00Z"),
      }),
      row({
        measuredOn: "2026-01-26",
        value: 75,
        createdAt: new Date("2026-01-26T09:00:00Z"),
      }),
    ];

    const series = buildSeries(rows, "weight_kg");

    expect(series).toHaveLength(1);
    expect(series[0]?.value).toBe(75);
  });

  it("the winner does not depend on input order (swapped orientation)", () => {
    const rows: RawSeriesRow[] = [
      row({
        measuredOn: "2026-01-26",
        value: 75,
        createdAt: new Date("2026-01-26T09:00:00Z"),
      }),
      row({
        measuredOn: "2026-01-26",
        value: 74,
        createdAt: new Date("2026-01-26T08:00:00Z"),
      }),
    ];

    const series = buildSeries(rows, "weight_kg");

    expect(series).toHaveLength(1);
    expect(series[0]?.value).toBe(75);
  });

  it("never produces two points on the same date, and never averages them", () => {
    const rows: RawSeriesRow[] = [
      row({
        measuredOn: "2026-01-26",
        value: 74,
        createdAt: new Date("2026-01-26T08:00:00Z"),
      }),
      row({
        measuredOn: "2026-01-26",
        value: 78,
        createdAt: new Date("2026-01-26T09:00:00Z"),
      }),
    ];

    const series = buildSeries(rows, "weight_kg");

    expect(series).toHaveLength(1);
    expect(series[0]?.value).not.toBe(76); // the average — never fabricated
  });
});

describe("buildSeries — sorting and epoch conversion", () => {
  it("returns points sorted by date ascending, regardless of input order", () => {
    const rows: RawSeriesRow[] = [
      row({ measuredOn: "2026-03-01", value: 72 }),
      row({ measuredOn: "2026-01-01", value: 78 }),
      row({ measuredOn: "2026-02-01", value: 75 }),
    ];

    const series = buildSeries(rows, "weight_kg");

    expect(series.map((point) => point.value)).toEqual([78, 75, 72]);
    expect(series[0]!.t).toBeLessThan(series[1]!.t);
    expect(series[1]!.t).toBeLessThan(series[2]!.t);
  });

  it("converts measured_on to a UTC epoch, immune to the process's local timezone", () => {
    const rows: RawSeriesRow[] = [row({ measuredOn: "2026-01-26" })];

    const series = buildSeries(rows, "weight_kg");

    expect(series[0]!.t).toBe(Date.UTC(2026, 0, 26));
  });
});
