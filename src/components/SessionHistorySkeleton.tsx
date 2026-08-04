import { Skeleton } from "@/components/ui/skeleton";

/**
 * Design (docs/designs/s03-log-measurement-session.md, état 5): three
 * blocks shaped like an Item — a title bar and two value lines — shown
 * while /historique reads Neon (cold start ~500ms). Never a full-screen
 * spinner (design-system.md §États). aria-hidden: it carries no real
 * content for a screen reader to announce.
 */
export function SessionHistorySkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          data-slot="history-skeleton-item"
          className="flex flex-col gap-2 rounded-lg border border-border p-3"
        >
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
