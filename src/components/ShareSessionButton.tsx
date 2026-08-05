"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const COPIED_MESSAGE = "Mesures copiées";
const FAILURE_MESSAGE =
  "Le partage a échoué. Copiez les valeurs depuis la session.";

// How long the button shows a check instead of its share glyph, after a
// copy. Long enough to be read, short enough that a second share on the
// same row doesn't look disabled.
const COPIED_FEEDBACK_MS = 2000;

/**
 * The one client boundary the history list needs (SessionHistoryList
 * stays a Server Component — its own test locks that). It receives the
 * finished text built server-side by `buildSessionShareText`
 * (src/lib/session-share.ts) and never formats a number itself.
 *
 * Two paths, in this order:
 *
 * 1. `navigator.share` — the native share sheet. On the phone this app is
 *    built for, that IS the WhatsApp route: one tap, pick the contact,
 *    done. Called synchronously from the click handler, with nothing
 *    awaited before it: the API requires an active user gesture, and an
 *    `await` first would spend it.
 * 2. `navigator.clipboard.writeText` — the fallback, for desktop and for
 *    any browser without the share sheet. The values land in the
 *    clipboard, which is what the feature was asked for in the first
 *    place: paste them wherever.
 *
 * A user who opens the share sheet and backs out gets `AbortError`, and
 * that is NOT a failure: it must stay silent. Toasting "échec" at someone
 * who simply changed their mind is the classic bug of this API, so the
 * rejection name is inspected rather than swallowed wholesale.
 */
export function ShareSessionButton({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The timer outlives a fast navigation away from /historique otherwise —
  // setState on an unmounted component, and a leak per shared row.
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        // Cancelled share sheet: the user's own decision, not an error to
        // report — and not a reason to fall through to the clipboard
        // either, which would copy something they just declined to send.
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        // Anything else (NotAllowedError, an unsupported payload) still
        // deserves the clipboard: the values are what matters.
      }
    }

    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(text);
      toast.success(COPIED_MESSAGE);
      setCopied(true);
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      toast.error(FAILURE_MESSAGE);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      className="text-muted-foreground"
      onClick={(event) => {
        // The row around this button is a stretched link to the edit
        // screen (SessionHistoryList): without this, sharing would also
        // navigate away.
        event.preventDefault();
        event.stopPropagation();
        void handleShare();
      }}
    >
      {copied ? (
        <Check aria-hidden="true" />
      ) : (
        <Share2 aria-hidden="true" />
      )}
    </Button>
  );
}
