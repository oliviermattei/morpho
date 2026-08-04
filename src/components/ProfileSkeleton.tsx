import { Skeleton } from "@/components/ui/skeleton";

/**
 * Design (docs/designs/s04-profile-height-bmi.md, état "Chargement — cold
 * start ~500 ms"): "une barre de libellé, une barre de champ, un bloc de
 * carte" while /profil reads Neon. Never a full-screen spinner
 * (design-system.md §États). aria-hidden: no real content for a screen
 * reader — the same motif as src/components/SessionHistorySkeleton.tsx.
 */
export function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
