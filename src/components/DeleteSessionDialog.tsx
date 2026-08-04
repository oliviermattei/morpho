"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatSessionDate } from "@/lib/date";
import { routes } from "@/lib/routes";

const DELETE_FAILURE_MESSAGE =
  "La suppression a échoué. Vérifiez votre connexion et réessayez.";

/**
 * s09 plan task 8, D2/D4/D9: the "zone dangereuse" island — the only
 * "use client" boundary this screen needs (R9: an alert-dialog trigger
 * on the history LIST would have forced the whole list client-side; here
 * it's the edit screen's own bottom section, already isolated).
 *
 * State machine, in the plan's own words: closed (nominal) → confirming
 * (open, pristine) → deleting (open, BOTH buttons disabled — état 13b,
 * the dialog stays open through the whole operation) → on success,
 * `router.replace` (never `push`: back navigation must not resurrect the
 * deleted session's screen, R10) → on failure (P8, review-caught in the
 * plan's own first draft), the dialog CLOSES and the error surfaces as
 * an `Alert`, in the page, above the trigger — never behind the
 * dialog's own overlay, where a closed-but-erroring dialog would hide it.
 */
export function DeleteSessionDialog({
  sessionId,
  measuredOn,
  measurementCount,
}: {
  sessionId: string;
  measuredOn: string;
  measurementCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  async function handleDelete() {
    setDeleting(true);
    setFailed(false);

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (response.status === 204) {
        toast.success("Session supprimée");
        router.replace(routes.history);
        return;
      }

      setFailed(true);
      setOpen(false);
    } catch {
      setFailed(true);
      setOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  const dateLabel = formatSessionDate(measuredOn, "UTC");
  const measurementLabel =
    measurementCount <= 1
      ? "1 mesure"
      : `${measurementCount} mesures`;

  return (
    <div className="flex flex-col gap-3">
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>{DELETE_FAILURE_MESSAGE}</AlertDescription>
        </Alert>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" className="h-11 w-full">
            Supprimer la session
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent
          ref={contentRef}
          // D9: focus opens on Annuler, the non-destructive default —
          // never Radix's own default focus target, which this overrides
          // explicitly rather than relying on it.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current
              ?.querySelector<HTMLButtonElement>(
                '[data-slot="alert-dialog-cancel"]',
              )
              ?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer la session du {dateLabel} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette session et ses {measurementLabel} seront définitivement
              supprimées. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11" disabled={deleting}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-11"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
