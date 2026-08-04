import { Suspense } from "react";
import Link from "next/link";
import { requireOnboarded } from "@/lib/onboarding-gate";
import { BottomNav } from "@/components/BottomNav";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SessionHistory } from "@/components/SessionHistory";
import { SessionHistorySkeleton } from "@/components/SessionHistorySkeleton";

// Every page that calls getAuth() needs this (plan decision 20) — see
// src/app/saisie/page.tsx and src/app/page.tsx for the same invariant.
export const dynamic = "force-dynamic";

export default async function HistoriquePage() {
  // Defense in depth, not redundant with src/proxy.ts (plan decision 22 —
  // same reasoning as src/app/(home)/page.tsx): the proxy already
  // redirected an anonymous visitor upstream; this is the check the SDK's
  // own docs call for inside every Server Component. ADR 020 folds the
  // onboarding check into the same helper. Deliberately kept outside the
  // <Suspense> boundary below it: the point of that boundary is to not
  // make the h1 and the "Nouvelle session" button wait on Neon, not to
  // paint them for a visitor who isn't authenticated.
  const { userId } = await requireOnboarded();

  return (
    <>
    <PageHeader title="Historique" />
    <main className="flex flex-1 flex-col gap-6 px-6 py-6 pb-28">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Historique</h1>
        <Button asChild className="h-11 w-full">
          <Link href="/saisie">Nouvelle session</Link>
        </Button>
      </div>
      <Suspense fallback={<SessionHistorySkeleton />}>
        <SessionHistory userId={userId} />
      </Suspense>
    </main>
    <BottomNav />
    </>
  );
}
