"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, TriangleAlert } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { purgeUserCaches } from "@/lib/pwa/cache-policy";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// design, "Écran authentifié provisoire": états — Succès (email + bouton),
// Chargement (déconnexion) — Spinner in the button, "Déconnexion…". story
// AC 5: ending the session sends the user back to the sign-in screen, and a
// reload must not restore it — signOut() clears the session cookies itself
// (research, "Le chemin nominal de signOut() supprime bien les cookies"),
// this only has to navigate once it resolves.
//
// Review finding 6: signOut()'s { error } branch must be handled, mirroring
// SignInScreen's own operation-error handling — stay on screen, show a
// destructive alert, reset isSigningOut so the user can retry. Navigating
// on error would send the user to the sign-in screen while their session
// cookies are still live, making sign-out look successful when it isn't.
const SIGN_OUT_FAILURE_MESSAGE = "Vérifiez votre connexion et réessayez.";

export function LogoutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [operationFailed, setOperationFailed] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    setOperationFailed(false);

    // s10 plan task 6, ADR 018 decision 3: purge FIRST, before signOut()
    // — this is the only site in the app that calls it (the sole
    // authClient.signOut() caller). A try/catch that never blocks
    // sign-out itself: a purge failure must not leave the user unable
    // to sign out, and signing out with a stale purge attempt is still
    // strictly safer than the reverse ordering (a signed-out device
    // still serving the previous account's cached data).
    try {
      await purgeUserCaches(globalThis.caches);
    } catch (thrown) {
      console.error(
        "[logout] purgeUserCaches failed",
        thrown instanceof Error ? thrown.name : typeof thrown,
      );
    }

    const { error } = await authClient.signOut();

    if (error) {
      setOperationFailed(true);
      setIsSigningOut(false);
      return;
    }

    router.push("/auth/sign-in");
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {operationFailed && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>La déconnexion a échoué</AlertTitle>
          <AlertDescription>{SIGN_OUT_FAILURE_MESSAGE}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        disabled={isSigningOut}
        onClick={() => void handleSignOut()}
      >
        {isSigningOut ? (
          <>
            <Spinner aria-label="Chargement" /> Déconnexion…
          </>
        ) : (
          <>
            <LogOut /> Se déconnecter
          </>
        )}
      </Button>
    </div>
  );
}
