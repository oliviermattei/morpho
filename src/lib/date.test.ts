import { afterEach, describe, expect, it } from "vitest";
import {
  formatAxisDate,
  formatFullDate,
  formatSessionDate,
  todayIsoDate,
} from "./date";

describe("todayIsoDate", () => {
  // new Date(year, month, day) sets *local* wall-clock fields regardless of
  // the host's timezone — the deterministic way to test this without
  // controlling process.env.TZ. The trap this guards against is
  // toISOString().slice(0, 10), which reads the UTC date instead: a
  // pre-dawn French weigh-in (UTC+2) would then log as the day before.
  it("builds YYYY-MM-DD from the device's local calendar date, not UTC", () => {
    expect(todayIsoDate(new Date(2026, 7, 2, 23, 59))).toBe("2026-08-02");
  });

  it("pads single-digit months and days", () => {
    expect(todayIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("formatSessionDate", () => {
  // Named trap (plan task 6): new Date("2026-08-02") is parsed as UTC
  // midnight; formatting that instant in a negative-offset timezone shows
  // August 1st. formatSessionDate must render the *calendar* date the
  // string names, in every timezone — never shift a day just because the
  // reader's clock is behind UTC.
  it("renders the full French date in UTC", () => {
    expect(formatSessionDate("2026-08-02", "UTC")).toBe("dimanche 2 août 2026");
  });

  it("renders the same calendar date in a negative-offset timezone — the trap this function exists to avoid", () => {
    expect(formatSessionDate("2026-08-02", "America/Los_Angeles")).toBe(
      "dimanche 2 août 2026",
    );
  });
});

// Plan s07 task 4 (D3): the chart's X axis ticks — abbreviated, day +
// short month, in French. Takes the epoch `t` buildSeries produces
// directly (src/lib/measurement-series.ts), not an ISO string.
describe("formatAxisDate", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("renders 'day short-month' in French, from a UTC epoch", () => {
    expect(formatAxisDate(Date.UTC(2026, 0, 5))).toBe("5 janv.");
  });

  it("renders a different month correctly", () => {
    expect(formatAxisDate(Date.UTC(2026, 1, 16))).toBe("16 févr.");
  });

  // Named trap (R2, plan task 4): explicit timeZone: 'UTC' means the
  // process's own TZ must never leak into the tick — a US-based CI
  // runner should render the same label as a French laptop.
  it("is immune to the process's local timezone", () => {
    process.env.TZ = "America/Los_Angeles";
    expect(formatAxisDate(Date.UTC(2026, 0, 5))).toBe("5 janv.");
  });
});

// Plan s07 task 4 (D3): the tooltip's full date — spelled out, no
// weekday (distinct from formatSessionDate, which s03's history reuses
// with a weekday). Also takes an epoch, mirroring formatAxisDate.
describe("formatFullDate", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("renders 'day month year' in full French, from a UTC epoch", () => {
    expect(formatFullDate(Date.UTC(2026, 0, 26))).toBe("26 janvier 2026");
  });

  it("is immune to the process's local timezone", () => {
    process.env.TZ = "America/Los_Angeles";
    expect(formatFullDate(Date.UTC(2026, 0, 26))).toBe("26 janvier 2026");
  });

  // R3's named failure mode: labelFormatter must never receive anything
  // but a real epoch. A caller that accidentally passes the series
  // name through (the exact bug R3 documents) must not silently render
  // a plausible-looking string — it must fail loudly enough to be
  // noticed in a test, not produce "Invalid Date".
  it("throws on a non-finite input rather than rendering 'Invalid Date'", () => {
    expect(() => formatFullDate(Number.NaN)).toThrow();
  });
});
