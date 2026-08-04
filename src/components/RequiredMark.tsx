import type { ReactNode } from "react";
import { FieldLabel } from "@/components/ui/field";

/**
 * The mandatory-field marker, and the legend that explains it.
 *
 * Before this, nothing on any form said which fields were mandatory —
 * the constraint existed only in the Zod schemas, so the first time a
 * user learned a field was required was when the server refused their
 * submission.
 *
 * The asterisk is deliberately rendered OUTSIDE the <label>, as a
 * sibling, never as a child of it. Inside, it would join the label's
 * text content and rename the field: "Adresse email" becomes "Adresse
 * email *" for anything that reads a label by its text — including
 * Testing Library's getByLabelText, which is how this project asserts
 * its forms. aria-hidden would have spared a screen reader but not that.
 * Colour never carries the information alone (design-system.md): the
 * glyph does, and the legend names it in words.
 */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}

/**
 * A FieldLabel with the marker beside it — the shape every mandatory
 * field on the four forms uses, so the row markup isn't repeated at each
 * call site. `htmlFor` still points at the control, so clicking the
 * label focuses it exactly as before.
 */
export function RequiredFieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-fit items-center gap-1">
      <FieldLabel htmlFor={htmlFor}>{children}</FieldLabel>
      <RequiredMark />
    </div>
  );
}

export function RequiredLegend() {
  return (
    <p className="flex items-center gap-1 text-sm text-muted-foreground">
      <span>Les champs marqués</span>
      <RequiredMark />
      <span>sont obligatoires.</span>
    </p>
  );
}
