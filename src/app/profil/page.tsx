import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { ProfileContent } from "@/components/ProfileContent";
import { ProfileSkeleton } from "@/components/ProfileSkeleton";
import { BottomNav } from "@/components/BottomNav";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { resolveRevision } from "@/lib/pwa/build-id";

// Plan decision 20, s01/s02/s03 precedent (src/app/api/health/route.ts,
// src/app/page.tsx, src/app/saisie/page.tsx): a Server Component calling
// getAuth() must opt out of static rendering, or `next build` fails on a
// machine with no secrets populated.
export const dynamic = "force-dynamic";

/**
 * ADR 020: deliberately NOT behind requireOnboarded(). This is where the
 * three onboarding answers get corrected, so gating it on having already
 * given them would make a wrong start date impossible to fix — and would
 * loop a user whose height got cleared between the two screens.
 */
export default async function ProfilPage() {
  const { data } = await getAuth().getSession();

  // Defense in depth, not redundant with src/proxy.ts (same reasoning as
  // every other authenticated page in this project) — and, like
  // src/app/historique/page.tsx, deliberately outside the <Suspense>
  // boundary below: that boundary exists so the header doesn't wait on
  // Neon, not so an unauthenticated visitor gets to see it.
  if (!data?.user) {
    redirect("/auth/sign-in");
  }

  return (
    <>
    <main className="flex flex-1 flex-col gap-6 px-6 py-6 pb-28">
      {/* No back arrow any more: BottomNav is mounted on every screen
          (ADR 020), so "go back to the home screen" is already one
          permanent tap away and a second control for it would just
          compete with the bar. */}
      <h1 className="text-2xl font-semibold text-foreground">Profil</h1>
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent userId={data.user.id} />
      </Suspense>
      {/* Sign-out lived in AppHeader's dropdown, which the redesign
          removed. It belongs on the profile screen, not in the nav bar:
          the bar has five slots and all five are destinations. */}
      <LogoutButton />
      {/* s10 plan task 7, criterion 6: the ONLY way to tell deployment A
          from deployment B by tapping the device — resolveRevision is
          shared with the /~offline precache entry (task 5) so the two
          never drift. A permanent interface element now, not debug
          scaffolding to remove later. */}
      <p className="text-center text-xs text-muted-foreground">
        {resolveRevision(process.env).slice(0, 7)}
      </p>
    </main>
    <BottomNav />
    </>
  );
}
