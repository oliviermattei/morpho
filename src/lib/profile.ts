import { eq } from "drizzle-orm";
import type { AppDatabase } from "./db";
import { profiles } from "./db/schema";

export type ProfileSex = (typeof profiles.sex.enumValues)[number];

export interface Profile {
  userId: string;
  heightCm: number | null;
  targetWeightKg: number | null;
  // ADR 020. Both nullable at this level even though the onboarding gate
  // treats them as mandatory: a row written before the redesign carries
  // neither, and this type describes what the database can hand back,
  // not what the app requires. src/lib/onboarding.ts is the single place
  // that turns "nullable in Postgres" into "complete or not".
  sex: ProfileSex | null;
  transformationStartedOn: string | null;
}

/**
 * `db` is AppDatabase — the same type s03's read-only functions take
 * (plan decision 21, its own critique C9), so this runs unmodified
 * against PGlite (tests) and Neon (production). `getDb()` is always
 * called by the caller, never memoised here or at module scope (s01
 * review, finding D — the AbortSignal bug that pattern reopens).
 *
 * s08 task 5 adds `targetWeightKg` to the projection: it's the same
 * row s04 already reads, one more nullable preference column on it
 * (the story's own scope note — no second read path).
 */
export async function getProfile(
  db: AppDatabase,
  userId: string,
): Promise<Profile | null> {
  const rows = await db
    .select({
      userId: profiles.userId,
      heightCm: profiles.heightCm,
      targetWeightKg: profiles.targetWeightKg,
      sex: profiles.sex,
      transformationStartedOn: profiles.transformationStartedOn,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  const row = rows[0];
  return row ? row : null;
}

/**
 * Upserts the caller's profile row. `heightCm: null` writes NULL (R7 —
 * clearing the field removes the height, it never leaves a stale value).
 * onConflictDoUpdate's target/set form, not the deprecated `where`
 * (research, pg-core/query-builders/insert.d.ts).
 *
 * `set: { heightCm }` only ever touches this one column on conflict —
 * a concurrent saveTargetWeight (below) on the same row never gets
 * clobbered by this call, and vice versa.
 */
export async function saveHeight(
  db: AppDatabase,
  userId: string,
  heightCm: number | null,
): Promise<void> {
  await db
    .insert(profiles)
    .values({ userId, heightCm })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { heightCm },
    });
}

/**
 * s08 task 5: saveHeight's exact twin for target_weight_kg. `null`
 * writes NULL — the only path back to "no target" (criterion 4, R7's
 * jumelle for this field). Reuses the same row and the same
 * onConflictDoUpdate target as saveHeight; s08 does not open a second
 * preference mechanism (the story's own scope note).
 */
export async function saveTargetWeight(
  db: AppDatabase,
  userId: string,
  targetWeightKg: number | null,
): Promise<void> {
  await db
    .insert(profiles)
    .values({ userId, targetWeightKg })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { targetWeightKg },
    });
}

/**
 * ADR 020: saveHeight's twin for the two onboarding columns. Written
 * together, in one upsert, because they are answered together on one
 * screen — and because a half-written onboarding (a sex with no start
 * date) would leave the gate refusing to open with no field left to
 * fill in.
 *
 * Same `set` discipline as its siblings: it touches these two columns
 * only, so a concurrent saveHeight/saveTargetWeight on the same row is
 * never clobbered.
 */
export async function saveIdentity(
  db: AppDatabase,
  userId: string,
  sex: ProfileSex,
  transformationStartedOn: string,
): Promise<void> {
  await db
    .insert(profiles)
    .values({ userId, sex, transformationStartedOn })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { sex, transformationStartedOn },
    });
}
