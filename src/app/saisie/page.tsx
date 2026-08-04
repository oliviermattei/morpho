import { Suspense } from "react";
import { requireOnboarded } from "@/lib/onboarding-gate";
import { BottomNav } from "@/components/BottomNav";
import { PageHeader } from "@/components/PageHeader";
import { MeasurementSessionFormLoader } from "@/components/MeasurementSessionFormLoader";
import { MeasurementSessionFormSkeleton } from "@/components/MeasurementSessionFormSkeleton";

// Plan decision 20, non-negotiable: any page calling getAuth() must carry
// this. createNeonAuth() validates its config synchronously and throws
// before the SDK ever reaches cookies(), so Next never auto-switches the
// route to dynamic on its own — without this, `next build` fails on any
// machine without secrets populated (invisible here: .env.local has them).
export const dynamic = "force-dynamic";

export default async function SaisiePage() {
  // Defense in depth, not redundant with src/proxy.ts — same reasoning as
  // src/app/(home)/page.tsx and src/app/historique/page.tsx. ADR 020 folds
  // the onboarding check into the same helper.
  const { userId } = await requireOnboarded();

  return (
    <>
      <PageHeader title="Saisie" />
      {/* pb-28 clears the fixed BottomNav — without it the submit button
          sits permanently under the bar. */}
      <main className="flex flex-1 flex-col gap-6 px-6 py-6 pb-28">
        <h1 className="text-2xl font-semibold text-foreground">
          Nouvelle session
        </h1>
        <Suspense fallback={<MeasurementSessionFormSkeleton />}>
          <MeasurementSessionFormLoader userId={userId} />
        </Suspense>
      </main>
      <BottomNav />
    </>
  );
}
