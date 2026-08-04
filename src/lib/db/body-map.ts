import { getDb } from "../db";
import { getBoundaryValuesByKind, type MeasurementBoundary } from "./latest-measurements";
import { getProfile } from "../profile";
import type { MeasurementKind } from "../measurements";

export interface BodyMapData {
  first: Partial<Record<MeasurementKind, MeasurementBoundary>>;
  last: Partial<Record<MeasurementKind, MeasurementBoundary>>;
  heightCm: number | null;
}

/**
 * Composes exactly three reads (plan s06 task 3) — no SQL of its own, no
 * direct access to `profiles` (getProfile is s04's function, called
 * as-is). `getDb()` is called here, inside the function, never at module
 * scope (s01 review, findings 1 and D) — the same invariant every
 * loader-shaped function in this repo follows
 * (MeasurementSessionFormLoader, ProfileContent).
 *
 * `userId` has no default and is never read from a client-supplied
 * value: the caller (src/app/(home)/page.tsx, task 7) passes in the id
 * `getAuth().getSession()` returned, and nothing else.
 */
export async function getBodyMapData(
  userId: string,
  // ADR 020: the home screen now goes through the onboarding gate, which
  // has already read this user's profile to decide whether to let them
  // in — and the gate guarantees the height is set. Passing it in skips
  // the third read entirely rather than querying the same row twice per
  // render, which on a cold Neon start is a second round trip for a
  // value the caller is holding. Callers that have no profile in hand
  // omit it and get the original three-read behaviour.
  knownHeightCm?: number,
): Promise<BodyMapData> {
  const db = getDb();
  const [first, last, profile] = await Promise.all([
    getBoundaryValuesByKind(db, userId, "first"),
    getBoundaryValuesByKind(db, userId, "last"),
    knownHeightCm === undefined ? getProfile(db, userId) : null,
  ]);

  return {
    first,
    last,
    heightCm: knownHeightCm ?? profile?.heightCm ?? null,
  };
}
