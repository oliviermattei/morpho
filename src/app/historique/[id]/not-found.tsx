import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { routes } from "@/lib/routes";

/**
 * s09 plan R6 (corrected during the plan's own revision): `notFound()`
 * only ever renders the CLOSEST not-found.tsx file — never an Empty
 * component reached directly from the page. This is that file: the
 * identical state for a nonexistent session, a malformed id, AND a
 * session that belongs to someone else (never a distinct "not yours"
 * message — R6's own point).
 */
export default function SessionNotFound() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-6">
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Session introuvable</EmptyTitle>
          <EmptyDescription>
            Elle a peut-être été supprimée.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild className="h-11 w-full">
            <Link href={routes.history}>Retour à l&apos;historique</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
