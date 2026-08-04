"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Plan s07 task 7, P7: re-runs the Server Component's render in place
 * (`router.refresh()` from `next/navigation`, never `next/cache`'s
 * function of the same name) rather than a full page reload. On a
 * `force-dynamic` page this replays the exact same read that just
 * failed, and — unlike a reload — it never loses
 * MeasurementChartsPanel's local measure selection (R6): "ne perd pas
 * l'état React non affecté" (node_modules/next/dist/docs/01-app/
 * 03-api-reference/04-functions/use-router.md).
 */
export function RetryButton() {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full"
      onClick={() => router.refresh()}
    >
      Réessayer
    </Button>
  );
}
