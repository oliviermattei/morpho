import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Plan s07 P12: this file exists at `src/app/graphes/`, its own
 * segment — without it, this route would inherit `src/app/(home)/
 * loading.tsx`, the SILHOUETTE's skeleton (s06 task 8, mounted at the
 * `(home)` route group only). The header and title render immediately
 * (no cold start dependency); only the card's content — value, chart
 * area, legend — is skeletal, in the shape task 6's success state
 * actually produces (design system §États: "jamais d'écran d'attente
 * bloquant").
 */
export default function GraphesLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-6">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground"
      >
        ‹ Accueil
      </Link>
      <h1 className="text-lg font-semibold text-foreground">Évolution</h1>

      {/* Only the skeleton placeholders themselves carry no real content
          for a screen reader — the heading and back link above stay in
          the accessibility tree, same motif as ProfileSkeleton.tsx. */}
      <div className="flex flex-col gap-4" aria-hidden="true">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-11 w-full" />
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
            {/* s08 task 8 (d): the target gap row's own placeholder —
                without it, a session with a target set would see the
                card grow by one line the instant real data replaces
                this skeleton. */}
            <Skeleton className="h-4 w-40" />
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-3 w-full" />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
