/**
 * "Today", built from the device's local calendar fields — never
 * `toISOString().slice(0, 10)`, which reads the UTC date. In France in
 * summer (UTC+2), a weigh-in logged before 02:00 local time would
 * otherwise date itself the day before (plan decision 9, research trap 3).
 */
export function todayIsoDate(referenceDate: Date = new Date()): string {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, "0");
  const day = String(referenceDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Renders a "YYYY-MM-DD" session date in full French, in an explicit
 * timezone (plan task 6). Named trap: `new Date("2026-08-02")` is parsed
 * as UTC midnight, so formatting it directly in a negative-offset
 * timezone (e.g. "America/Los_Angeles") shows August 1st. Anchoring at
 * noon UTC keeps the calendar date stable across every realistic
 * timezone, so the same string renders the same date everywhere.
 */
export function formatSessionDate(iso: string, timeZone: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const anchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(anchor);
}

/**
 * The X axis tick label for the measurement charts (plan s07 task 4,
 * design-system.md §Format de date): abbreviated day + short month,
 * e.g. "5 janv.". Takes the UTC epoch buildSeries produces
 * (src/lib/measurement-series.ts) directly — `timeZone: 'UTC'` is
 * explicit so the label never shifts by a day on a process whose local
 * TZ sits west of Greenwich (the same trap formatSessionDate guards
 * against for the ISO-string case above).
 */
export function formatAxisDate(epochMs: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(epochMs);
}

/**
 * The chart tooltip's full date (plan s07 task 4, R3): spelled out,
 * e.g. "26 janvier 2026" — no weekday, unlike formatSessionDate's
 * history-list rendering, which is a different surface with a different
 * convention. Also takes an epoch, and also pins `timeZone: 'UTC'`.
 *
 * Deliberately narrow: this never receives anything but the `t` a real
 * chart point carries. R3's named bug (ChartTooltipContent's
 * labelFormatter handed the series name instead of the axis value on a
 * type="number" XAxis) must never reach this function silently — the
 * caller (MeasurementChart.tsx) reads the epoch from
 * `payload?.[0]?.payload?.t` and renders nothing if it's absent, rather
 * than calling this with a guess. Intl.DateTimeFormat itself throws
 * RangeError on a non-finite input, which this function leaves
 * un-caught: a loud failure here is exactly what would have caught R3's
 * bug in testing, instead of a plausible-looking wrong string.
 */
export function formatFullDate(epochMs: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(epochMs);
}
