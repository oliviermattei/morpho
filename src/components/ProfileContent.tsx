import { getDb } from "@/lib/db";
import { getLatestWeighIn } from "@/lib/measurement-sessions";
import { getProfile } from "@/lib/profile";
import { BmiCard } from "./BmiCard";
import { HeightForm } from "./HeightForm";

/**
 * The one place on /profil's read path that touches the database
 * (design-system.md §États, "cold start ~500 ms"; task 8/9) —
 * deliberately its own module, not an inline closure inside a
 * <Suspense>, so a test can call it directly:
 * `await ProfileContent({ userId })`, the same motif
 * src/components/SessionHistory.tsx already established. getDb() is
 * called inside this function, never at module scope (s01 review,
 * finding D).
 */
export async function ProfileContent({ userId }: { userId: string }) {
  const db = getDb();
  const [profile, latestWeighIn] = await Promise.all([
    getProfile(db, userId),
    getLatestWeighIn(db, userId),
  ]);
  const heightCm = profile?.heightCm ?? null;
  const targetWeightKg = profile?.targetWeightKg ?? null;

  return (
    <>
      <HeightForm
        initialHeightCm={heightCm}
        initialTargetWeightKg={targetWeightKg}
        initialSex={profile?.sex ?? null}
        initialStartedOn={profile?.transformationStartedOn ?? null}
      />
      <BmiCard heightCm={heightCm} latestWeighIn={latestWeighIn} />
    </>
  );
}
