import { screen, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

/**
 * Picks a calendar day on a DatePickerField, from the "YYYY-MM-DD" the
 * test wants — the replacement for the `user.type(dateInput, "2026-06-23")`
 * that worked while the field was an `<input type="date">`.
 *
 * Test-only, and deliberately shared: four test files drive the same
 * picker, and four hand-rolled versions of "open the popover, move to
 * the right month, find the cell" is four things to fix the next time
 * react-day-picker changes its markup.
 *
 * The day cell is found by `data-day`, the ISO attribute react-day-picker
 * puts on every cell — not by its visible number, which appears twice in
 * a grid showing the neighbouring months' overflow days (a plain "1"
 * matches both June 1st and July 1st).
 *
 * The month/year dropdowns are used rather than clicking "previous
 * month" N times: it is one interaction whatever the distance, so a test
 * picking a date years back costs the same as one picking today.
 */
export async function selectIsoDate(
  user: ReturnType<typeof userEvent.setup>,
  fieldLabel: string,
  iso: string,
): Promise<void> {
  const [year, month] = iso.split("-").map(Number);

  await user.click(screen.getByLabelText(fieldLabel));

  const calendar = await screen.findByRole("dialog");
  // Year first: it is what determines which months are selectable when
  // the picker carries a `max` bound.
  await user.selectOptions(
    within(calendar).getByLabelText("Choisir l'année"),
    String(year),
  );
  await user.selectOptions(
    within(calendar).getByLabelText("Choisir le mois"),
    String(month - 1),
  );

  const cell = calendar.querySelector<HTMLElement>(`[data-day="${iso}"]`);
  if (cell === null) {
    throw new Error(
      `selectIsoDate: no day cell for ${iso} — it is probably outside the picker's allowed window.`,
    );
  }
  // The `data-day` attribute sits on the gridcell; the click target is
  // the button inside it. Clicking the cell itself does nothing at all —
  // silently, which is exactly the sort of no-op that makes a test pass
  // for the wrong reason, hence the explicit failure below.
  const dayButton = cell.querySelector<HTMLElement>("button");
  if (dayButton === null) {
    throw new Error(
      `selectIsoDate: the cell for ${iso} carries no button — it is probably disabled.`,
    );
  }
  await user.click(dayButton);
}
