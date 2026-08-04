/**
 * The shared "block the submit and show me where the problem is" step of
 * the three forms that validate client-side (session, mot de passe,
 * profil). One definition, because the three screens had drifted into
 * three different ideas of what a refused submission looks like: one
 * scrolled nowhere, one focused nothing, and the third only rendered a
 * message below the fold.
 *
 * Takes the field ids in the order they appear ON SCREEN, not the order
 * the validator happened to produce — "the first problem" means the
 * topmost one to the person reading the form, and a validator is free
 * to report them in any order it likes.
 */
export function focusFirstInvalidField(
  fieldIds: readonly string[],
  invalid: (fieldId: string) => boolean,
  doc: Pick<Document, "getElementById"> = document,
): string | null {
  for (const fieldId of fieldIds) {
    if (!invalid(fieldId)) continue;

    const element = doc.getElementById(fieldId);
    if (element === null) continue;

    // `block: "center"` rather than the default "start": a field scrolled
    // to the very top of the viewport sits under the header on the
    // screens that have one, and its error message — which is the whole
    // point of scrolling there — renders BELOW it, so "start" can land
    // the explanation off-screen.
    element.scrollIntoView({ behavior: "smooth", block: "center" });

    // preventScroll, because scrollIntoView above already did it: letting
    // focus() scroll too produces a second, instant jump that fights the
    // smooth one and lands somewhere between the two.
    if (element instanceof HTMLElement) {
      element.focus({ preventScroll: true });
    }
    return fieldId;
  }
  return null;
}
