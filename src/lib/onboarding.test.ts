// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  START_DATE_FORMAT_ERROR,
  START_DATE_FUTURE_ERROR,
  START_DATE_TOO_OLD_ERROR,
  daysSince,
  formatDayCounter,
  isOnboarded,
  makeStartDateSchema,
  sexInputSchema,
} from "./onboarding";
import type { Profile } from "./profile";

const COMPLETE: Profile = {
  userId: "user-1",
  heightCm: 175,
  targetWeightKg: null,
  sex: "male",
  transformationStartedOn: "2026-06-23",
};

describe("isOnboarded", () => {
  it("accepts a profile carrying all three answers", () => {
    expect(isOnboarded(COMPLETE)).toBe(true);
  });

  it("refuses a null profile — a user who has never saved anything", () => {
    expect(isOnboarded(null)).toBe(false);
  });

  // One case per column: a partial write must not open the gate, or the
  // home screen renders with no silhouette to draw or no day to count
  // from.
  it.each([
    ["heightCm", { ...COMPLETE, heightCm: null }],
    ["sex", { ...COMPLETE, sex: null }],
    ["transformationStartedOn", { ...COMPLETE, transformationStartedOn: null }],
  ])("refuses a profile missing %s", (_column, profile) => {
    expect(isOnboarded(profile as Profile)).toBe(false);
  });

  // targetWeightKg is a preference, not an onboarding answer — the
  // onboarding screen never asks for it.
  it("does not require a target weight", () => {
    expect(isOnboarded({ ...COMPLETE, targetWeightKg: null })).toBe(true);
  });
});

describe("sexInputSchema", () => {
  it.each(["male", "female"])("accepts %s", (value) => {
    expect(sexInputSchema.safeParse(value).success).toBe(true);
  });

  it.each(["", "Homme", "other", "MALE"])("refuses %s", (value) => {
    expect(sexInputSchema.safeParse(value).success).toBe(false);
  });
});

describe("makeStartDateSchema", () => {
  const schema = makeStartDateSchema("2026-08-04");

  it("accepts a past ISO date and returns it untouched", () => {
    const result = schema.safeParse("2026-06-23");
    expect(result.success && result.data).toBe("2026-06-23");
  });

  it("accepts today itself — day 0 is a legitimate start", () => {
    expect(schema.safeParse("2026-08-04").success).toBe(true);
  });

  it("trims before parsing", () => {
    const result = schema.safeParse("  2026-06-23 ");
    expect(result.success && result.data).toBe("2026-06-23");
  });

  it.each(["", "23/06/2026", "2026-6-23", "hier"])(
    "refuses the malformed input %s",
    (raw) => {
      const result = schema.safeParse(raw);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(START_DATE_FORMAT_ERROR);
      }
    },
  );

  // The named trap: Date.UTC(2026, 1, 31) silently rolls forward to
  // March 3rd. Without the round-trip check, "2026-02-31" would be
  // stored as a valid start date and the day counter would be wrong from
  // then on.
  it("refuses a date that does not exist on the calendar", () => {
    const result = schema.safeParse("2026-02-31");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(START_DATE_FORMAT_ERROR);
    }
  });

  it("refuses a date in the future", () => {
    const result = schema.safeParse("2026-08-05");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(START_DATE_FUTURE_ERROR);
    }
  });

  it("refuses a mistyped year before 2000", () => {
    const result = schema.safeParse("0225-06-23");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(START_DATE_TOO_OLD_ERROR);
    }
  });
});

describe("daysSince", () => {
  it("counts the start date itself as day 0", () => {
    expect(daysSince("2026-08-04", "2026-08-04")).toBe(0);
  });

  it("counts whole days", () => {
    expect(daysSince("2026-06-23", "2026-08-04")).toBe(42);
  });

  it("crosses a month and a year boundary correctly", () => {
    expect(daysSince("2025-12-31", "2026-01-01")).toBe(1);
  });

  // Both ends are anchored at noon UTC, so the 23-hour civil day of a
  // spring DST transition still measures one day. Europe/Paris moved to
  // summer time on 2026-03-29.
  it("is not thrown off by a DST transition between the two dates", () => {
    expect(daysSince("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("clamps a future start date to 0 rather than rendering a negative", () => {
    expect(daysSince("2026-09-01", "2026-08-04")).toBe(0);
  });
});

describe("formatDayCounter", () => {
  it("renders the J+N form the header shows", () => {
    expect(formatDayCounter(42)).toBe("J+42");
    expect(formatDayCounter(0)).toBe("J+0");
  });
});
