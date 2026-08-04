import { z } from "zod";
import type { Profile, ProfileSex } from "./profile";
import { todayIsoDate } from "./date";

/**
 * ADR 020. The redesign puts three facts on the home screen that the app
 * never asked for: which silhouette to draw (sex), what "J+42" counts
 * from (the start date), and the height the IMC card now always shows.
 * This module owns the one definition of "the profile answers all
 * three" — and therefore of what the onboarding gate lets through.
 *
 * Pure: no database, no session, no React. The gate
 * (src/lib/onboarding-gate.ts) reads a profile and asks this module;
 * this module never reads anything itself.
 */

export const SEX_LABELS: Record<ProfileSex, string> = {
  male: "Homme",
  female: "Femme",
};

export const SEX_VALUES = ["male", "female"] as const;

/**
 * The shape the rest of the app can rely on once the gate has run: the
 * same Profile, minus the three nullabilities the gate just proved away.
 * Server Components take this type rather than re-checking for null on
 * every read (a check that would have no sensible else branch).
 */
export interface OnboardedProfile extends Profile {
  heightCm: number;
  sex: ProfileSex;
  transformationStartedOn: string;
}

export function isOnboarded(
  profile: Profile | null,
): profile is OnboardedProfile {
  return (
    profile !== null &&
    profile.heightCm !== null &&
    profile.sex !== null &&
    profile.transformationStartedOn !== null
  );
}

export const SEX_FORMAT_ERROR = "Choisissez homme ou femme.";
export const START_DATE_FORMAT_ERROR = "Indiquez une date valide.";
export const START_DATE_FUTURE_ERROR = "Cette date est dans le futur.";
export const START_DATE_TOO_OLD_ERROR = "Indiquez une date après 2000.";

// The floor is arbitrary but not decorative: it turns a mistyped year
// ("0225") into a field error instead of a "J+657000" on the home
// screen. Above it, no opinion — someone may legitimately be counting
// from years back.
//
// Exported since the date picker replaced <input type="date">: the
// calendar needs the same floor as a `min`, or its year dropdown offers
// a century of years the server would refuse — and renders every one of
// them on every mount.
export const EARLIEST_START_DATE = "2000-01-01";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const sexInputSchema = z.enum(SEX_VALUES, {
  error: SEX_FORMAT_ERROR,
});

/**
 * A calendar day stays a string from the `<input type="date">` all the
 * way to Postgres's `date` column — it is never routed through a JS
 * Date, which would reintroduce the UTC shift the whole codebase avoids
 * (src/lib/date.ts). The round-trip check below is what makes the string
 * comparisons that follow safe: it rejects "2026-02-31", which
 * Date.UTC() would silently roll forward to March 3rd.
 *
 * The comparisons themselves are lexicographic on purpose — ISO
 * "YYYY-MM-DD" sorts chronologically as text, so no date arithmetic is
 * involved in deciding "is this in the future".
 */
export function makeStartDateSchema(today: string = todayIsoDate()) {
  return z.string().transform((raw, ctx): string => {
    const trimmed = raw.trim();
    if (!ISO_DATE_PATTERN.test(trimmed)) {
      ctx.addIssue({ code: "custom", message: START_DATE_FORMAT_ERROR });
      return z.NEVER;
    }
    const [year, month, day] = trimmed.split("-").map(Number);
    const anchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const roundTrip = anchor.toISOString().slice(0, 10);
    if (roundTrip !== trimmed) {
      ctx.addIssue({ code: "custom", message: START_DATE_FORMAT_ERROR });
      return z.NEVER;
    }
    if (trimmed > today) {
      ctx.addIssue({ code: "custom", message: START_DATE_FUTURE_ERROR });
      return z.NEVER;
    }
    if (trimmed < EARLIEST_START_DATE) {
      ctx.addIssue({ code: "custom", message: START_DATE_TOO_OLD_ERROR });
      return z.NEVER;
    }
    return trimmed;
  });
}

/**
 * Whole days between the start date and today, floored at 0. Both dates
 * are anchored at noon UTC before subtracting, which is what makes the
 * result immune to the DST transitions that sit between them: a 23-hour
 * or 25-hour civil day still measures 24 hours from noon to noon.
 *
 * Day 0 is the start date itself — "J+0" the day you begin, "J+1"
 * tomorrow. A start date in the future cannot be stored (the schema
 * above refuses it), but is clamped to 0 here anyway rather than
 * rendering "J+-3" if a row ever gets one another way.
 */
export function daysSince(
  startIso: string,
  today: string = todayIsoDate(),
): number {
  const toNoonUtc = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return Date.UTC(year, month - 1, day, 12, 0, 0);
  };
  const elapsed = toNoonUtc(today) - toNoonUtc(startIso);
  return Math.max(0, Math.round(elapsed / 86_400_000));
}

export function formatDayCounter(days: number): string {
  return `J+${days}`;
}
