import { expect, test } from "@playwright/test";

// Plan s07 task 9, project "mobile" (already forced to 375x812 by s01,
// verified in playwright.config.ts — not re-overridden here).
test.describe("unauthenticated visitors are redirected to sign-in", () => {
  test("/graphes redirects to the sign-in screen", async ({ page }) => {
    await page.goto("/graphes");

    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});

// Decision 16 (s06), reused verbatim by this story's own task 9: the
// session-injection mechanism (storageState via E2E_STORAGE_STATE) is
// documented — ADR 011 — but nothing on this branch implements the
// globalSetup it describes (no tests/e2e/global-setup.* exists), and
// this execution must not send any email, which is exactly what running
// that setup would do. This block skips cleanly, with an explicit
// message — never a jsdom substitute for what can only be measured in a
// real browser (a real tap-triggered tooltip, the true rendered
// scrollWidth of a popover), and never a silently-passing test.skip.
test.describe("authenticated — no horizontal overflow, tap reveals the full date and value (criteria 6, 7)", () => {
  test.skip(
    !process.env.E2E_STORAGE_STATE,
    "E2E_STORAGE_STATE is not set — no session-injection mechanism is " +
      "wired up on this branch yet (ADR 011 documents the approach, " +
      "nothing implements it). See the review for the manual protocol " +
      "that covers these criteria instead.",
  );

  test.use({
    storageState: process.env.E2E_STORAGE_STATE,
  });

  test("criterion 7: no horizontal scroll and no element overflows the 375px viewport, popover open included", async ({
    page,
  }) => {
    await page.goto("/graphes");

    const hasHorizontalScrollClosed = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(hasHorizontalScrollClosed).toBe(false);

    // Open the measure selector's popover — the widest transient element
    // on this screen (11 rows across two groups) — and re-check with it
    // open, not just the resting state.
    await page.getByRole("combobox", { name: "Mesure" }).click();
    await page.getByRole("listbox").waitFor();

    const hasHorizontalScrollOpen = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(hasHorizontalScrollOpen).toBe(false);
  });

  test("criterion 6: tapping a point reveals its exact date and value", async ({
    page,
  }) => {
    await page.goto("/graphes");

    const dot = page.locator(".recharts-line-dot").first();
    await dot.waitFor();
    await dot.click();

    // The tooltip's date is spelled out in full French (formatFullDate),
    // never the abbreviated axis form and never a raw epoch — this is
    // exactly R3's named failure mode (labelFormatter thrown at a
    // RangeError) surfacing for real, in a real browser, if it regresses.
    await expect(page.getByText(/^\d{1,2} [a-zéû]+ \d{4}$/)).toBeVisible();
  });
});
