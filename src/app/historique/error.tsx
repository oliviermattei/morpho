"use client";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * Design état 7 ("Erreur de lecture"): plain-language message, no HTTP
 * status code on screen — `error` is received but never rendered.
 *
 * Wired to `unstable_retry()`, not `reset()`. Verified in the installed
 * runtime (node_modules/next/dist/client/components/error-boundary.js:
 * 39-48): `reset()` only clears the boundary's local error state — it
 * does not re-fetch the failed read, so the just-thrown error would be
 * re-thrown immediately and the button would be a no-op. `unstable_retry()`
 * re-fetches and re-renders the boundary's children (Next docs,
 * error.md), which is what actually gives the user a working "try again".
 */
export default function HistoriqueError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry: () => void;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Impossible de charger l&apos;historique</EmptyTitle>
        <EmptyDescription>
          Vérifiez votre connexion et réessayez.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          type="button"
          className="h-11 w-full"
          onClick={() => unstable_retry()}
        >
          Réessayer
        </Button>
      </EmptyContent>
    </Empty>
  );
}
