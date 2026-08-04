import { Suspense } from "react";
import Link from "next/link";
import { requireOnboarded } from "@/lib/onboarding-gate";
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
    <main className="flex flex-1 flex-col gap-6 px-6 py-6">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground"
      >
        ‹ Retour
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">
        Nouvelle session
      </h1>
      <Suspense fallback={<MeasurementSessionFormSkeleton />}>
        <MeasurementSessionFormLoader userId={userId} />
      </Suspense>
    </main>
  );
}
