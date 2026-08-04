import type { ReactNode } from "react";
import { FieldLabel } from "@/components/ui/field";

/**
 * The mandatory-field marker.
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
 *
 * It inherits the label's colour rather than carrying its own: the
 * convention is universal enough that a per-form legend spelling it out
 * was noise, and a red glyph next to an untouched field read as an
 * error the user had not made yet.
 */
export function RequiredMark() {
  return <span aria-hidden="true">*</span>;
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
