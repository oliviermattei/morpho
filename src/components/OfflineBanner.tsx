"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOnlineStatus } from "@/lib/pwa/use-online-status";

// docs/design-system.md § Textes hors ligne — fixed there so it's never
// reinvented per screen.
const OFFLINE_BANNER_MESSAGE =
  "Vous êtes hors ligne. Les données affichées peuvent être périmées.";

/**
 * s10 plan task 7, criterion 4. `Alert` (shadcn) already carries
 * `role="alert"` by default — a live region on its own. Renders nothing
 * at all when the data isn't (or isn't known to be) stale — never an
 * empty, invisible-but-present banner.
 */
export function OfflineBanner() {
  const { isStale } = useOnlineStatus();

  if (!isStale) {
    return null;
  }

  return (
    <Alert
      variant="destructive"
      className="rounded-none border-x-0 border-t-0"
    >
      <AlertDescription>{OFFLINE_BANNER_MESSAGE}</AlertDescription>
    </Alert>
  );
}
