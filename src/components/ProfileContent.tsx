import { getDb } from "@/lib/db";
import { getProfile } from "@/lib/profile";
import { AccountSection } from "./AccountSection";
import { HeightForm } from "./HeightForm";
import { FieldSeparator } from "./ui/field";

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
export async function ProfileContent({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const db = getDb();
  const profile = await getProfile(db, userId);

  return (
    <>
      <HeightForm
        initialHeightCm={profile?.heightCm ?? null}
        initialTargetWeightKg={profile?.targetWeightKg ?? null}
        initialSex={profile?.sex ?? null}
        initialStartedOn={profile?.transformationStartedOn ?? null}
      />
      <FieldSeparator />
      {/* The BMI card that used to close this screen is gone: it
          duplicated the home screen's IMC tile, which is where the
          number belongs — /profil is where values are ENTERED, and a
          derived read-only figure in the middle of a form invited the
          reading that it too could be edited. The last weigh-in read
          that fed it (getLatestWeighIn) goes with it, so this component
          is down to one query. */}
      <AccountSection email={email} />
    </>
  );
}
