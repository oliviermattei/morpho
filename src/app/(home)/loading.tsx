import { BottomNav } from "@/components/BottomNav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Plan s06 task 8, decision 18, unchanged by the redesign: this file
 * exists ONLY inside the (home) route group — never at
 * src/app/loading.tsx, which would wrap /saisie, /historique and /profil
 * too (none of which override it) and show the silhouette's skeleton as
 * the wait state for the capture form.
 *
 * ADR 020 changes what it mimics. The header no longer carries the
 * primary action, so it is drawn as skeletons rather than mounted for
 * real; BottomNav IS mounted for real, for the reason AppHeader used to
 * be — it holds the one-tap route to /saisie, and freezing it behind a
 * spinner during a ~500 ms Neon cold start would make the app feel
 * locked. It reads only the pathname, never the database.
 *
 * The silhouette placeholder is a single block at the panel's real
 * height (402px, src/components/BodySilhouette.tsx) so the layout does
 * not jump when the drawing and its labels replace it.
 */
export default function HomeLoading() {
  return (
    <>
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2.5">
        <span className="text-xl font-bold tracking-tight text-foreground">
          morpho
        </span>
        <Skeleton className="h-4 w-32" />
      </header>
      <OfflineBanner />
      <main className="flex flex-1 flex-col gap-3 px-4 pb-28">
        <div
          className="mx-auto w-full max-w-[358px]"
          style={{ height: "402px" }}
        >
          <Skeleton className="h-full w-full rounded-xl" />
        </div>
        <Skeleton className="mx-auto h-3 w-56" />
        <div className="grid grid-cols-2 gap-2.5">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
