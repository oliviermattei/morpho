import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * s10 plan task 6, decision 15: the technical fallback for a document
 * request no strategy can answer — a route this device never visited
 * while online. `force-static`: no `getAuth()` call, no database
 * access, no session read anywhere in this file — it must render with
 * zero network, since it is precached and served exactly when there is
 * none.
 */
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-6">
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Vous êtes hors ligne</EmptyTitle>
          <EmptyDescription>
            Cette page n&apos;a pas encore été consultée en ligne sur cet
            appareil. Reconnectez-vous puis réessayez.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {/* A bare anchor, not <Link> — a full reload is what a retry
              needs once the network is back (same motif as
              src/app/(home)/page.tsx's own read-failure retry). */}
          <Button asChild className="h-11 w-full" variant="outline">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- deliberate full reload */}
            <a href="/">Réessayer</a>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
