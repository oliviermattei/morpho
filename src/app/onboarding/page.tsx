import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getProfile } from "@/lib/profile";
import { isOnboarded } from "@/lib/onboarding";
import { routes } from "@/lib/routes";
import { OnboardingForm } from "@/components/OnboardingForm";

// Same reason as every other page that calls getAuth() (plan decision 20
// of s03): createNeonAuth() validates its config synchronously and
// throws before cookies() is ever reached, so Next never switches this
// route to dynamic on its own.
export const dynamic = "force-dynamic";

/**
 * ADR 020: the mandatory first screen. It does NOT go through
 * requireOnboarded() — that helper redirects here, and a page that
 * redirected to itself would loop. It checks the session itself, and
 * bounces a profile that is ALREADY complete back to the home screen, so
 * the onboarding can't be re-opened by typing the URL.
 */
export default async function OnboardingPage() {
  const { data } = await getAuth().getSession();

  if (!data?.user) {
    redirect(routes.signIn);
  }

  const profile = await getProfile(getDb(), data.user.id);

  if (isOnboarded(profile)) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <div>
          <div className="text-sm text-muted-foreground">morpho</div>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">
            Avant de commencer
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Trois réponses, une seule fois. Vous pourrez les corriger à tout
            moment depuis votre profil.
          </p>
        </div>
        <OnboardingForm
          // Pre-filled from whatever is already stored: a user who
          // answered two of the three questions and lost the connection
          // on the third comes back to their own answers, not to an
          // empty form.
          initialHeightCm={profile?.heightCm ?? null}
          initialSex={profile?.sex ?? null}
          initialStartedOn={profile?.transformationStartedOn ?? null}
          redirectTo="/"
          submitLabel="Commencer"
        />
      </div>
    </main>
  );
}
