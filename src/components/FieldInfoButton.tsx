"use client";

import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputGroupButton } from "@/components/ui/input-group";

/**
 * The information affordance that replaces the paragraph of
 * FieldDescription under every profile field.
 *
 * Those descriptions were each two to four lines of explanatory prose,
 * stacked under fields that are themselves one line tall — on a phone
 * the form read as mostly explanation. The text is not deleted (it
 * answers a real question, just not one asked on every visit): it moves
 * behind an info icon glued to the right of the input, one tap away.
 *
 * Rendered inside an InputGroupAddon by its callers, which is why this
 * is an InputGroupButton and not a plain Button — the addon styling and
 * the focus ring around the whole group depend on that slot.
 */
export function FieldInfoButton({
  title,
  children,
  label,
}: {
  title: string;
  children: ReactNode;
  /** Accessible name — the visible control is an icon only. */
  label: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <InputGroupButton
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        <Info className="size-4" aria-hidden="true" />
      </InputGroupButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription asChild>
              <div className="text-left">{children}</div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-11 w-full">
                Fermer
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
