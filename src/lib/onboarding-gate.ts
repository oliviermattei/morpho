import { redirect } from "next/navigation";
import { getAuth } from "./auth";
import { getDb } from "./db";
import { getProfile } from "./profile";
import { isOnboarded, type OnboardedProfile } from "./onboarding";
import { routes } from "./routes";

/**
 * ADR 020: the one gate every authenticated screen goes through. Two
 * redirects, in order — no session at all sends the visitor to sign-in,
 * an incomplete profile sends them to the onboarding.
 *
 * Both `redirect()` calls sit OUTSIDE any try/catch. redirect() signals
 * by throwing NEXT_REDIRECT, and catching it would turn "go sign in"
 * into whatever the caller's error branch renders
 * (node_modules/next/dist/docs/…/redirect.md, and the reason
 * src/app/(home)/page.tsx already separates its own redirect from its
 * data read).
 *
 * `/profil` deliberately does NOT call this: it is where the three
 * answers get corrected, so gating it behind having already answered
 * them would make a wrong start date impossible to fix. `/onboarding`
 * doesn't call it either, for the obvious reason.
 */
export interface GatedSession {
  userId: string;
  profile: OnboardedProfile;
}

export async function requireOnboarded(): Promise<GatedSession> {
  const { data } = await getAuth().getSession();

  if (!data?.user) {
    redirect(routes.signIn);
  }

  const userId = data.user.id;
  // Not wrapped: a failure to read the profile here is an infrastructure
  // failure, and letting it throw hands it to the page's own error
  // boundary. Swallowing it would mean sending a fully-onboarded user
  // back through the onboarding every time Neon hiccups — a data-losing
  // outcome dressed up as resilience.
  const profile = await getProfile(getDb(), userId);

  if (!isOnboarded(profile)) {
    redirect(routes.onboarding);
  }

  return { userId, profile };
}
