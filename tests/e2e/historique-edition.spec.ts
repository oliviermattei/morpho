import { expect, test } from "@playwright/test";

// Plan s09 task 10, project "mobile" (already forced to 375x812 by s01).
// A syntactically-valid uuid is enough to exercise the redirect: the
// proxy's negative matcher protects /historique/** regardless of what
// the segment resolves to — it never reaches the page at all.
const SOME_SESSION_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

test.describe("unauthenticated visitors are redirected to sign-in", () => {
  test("/historique/:id redirects to the sign-in screen", async ({
    page,
  }) => {
    await page.goto(`/historique/${SOME_SESSION_ID}`);

    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});

// s09 R17: the plan's own text names ADR 011's globalSetup/E2E_TEST_EMAIL
// as the session mechanism — but nothing on this branch implements that
// globalSetup (no tests/e2e/global-setup.* exists, exactly as s06/s07/s08
// already found), and this execution is explicitly forbidden from
// sending any email, which running signIn.magicLink() for real would do.
// Consistent with body-map.spec.ts, graphes.spec.ts and
// target-weight.spec.ts (all merged onto this same branch), this block
// gates on E2E_STORAGE_STATE — a storageState produced once, by hand,
// after a real magic link — and skips cleanly with an explicit message
// when it's absent. Never a jsdom substitute for what only a real
// browser can prove (a real tap-triggered AlertDialog, the true rendered
// scrollWidth of an open dialog).
test.describe("authenticated — open, delete, no horizontal overflow (criteria 1, 4, 5)", () => {
  test.skip(
    !process.env.E2E_STORAGE_STATE,
    "E2E_STORAGE_STATE is not set — no session-injection mechanism is " +
      "wired up on this branch yet (ADR 011 documents the approach, " +
      "nothing implements it), and this execution must not send an " +
      "email to run the globalSetup the plan's own text names. See the " +
      "review for the manual protocol and for criterion 5's automatic " +
      "proof, which does not depend on this spec (task 5, PGlite).",
  );

  test.use({
    storageState: process.env.E2E_STORAGE_STATE,
  });

  test("criterion 1: opening a session from the list shows its recorded values, and an absent measurement is an empty field", async ({
    page,
  }) => {
    await page.goto("/historique");

    // The first row in the list — most recent session.
    await page.getByRole("link", { name: /Modifier/ }).first().click();

    await expect(page).toHaveURL(/\/historique\/.+/);
    await expect(page.getByLabel("Date")).not.toHaveValue("");
  });

  test("criteria 4 and 5: Supprimer opens the dialog, Annuler leaves the row, confirming removes it from the list", async ({
    page,
  }) => {
    await page.goto("/historique");
    const rowCountBefore = await page.getByRole("link", { name: /Modifier/ }).count();

    await page.getByRole("link", { name: /Modifier/ }).first().click();
    await page.getByRole("button", { name: "Supprimer la session" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();

    await page.getByRole("button", { name: "Annuler" }).click();
    await expect(page.getByRole("alertdialog")).toBeHidden();

    await page.getByRole("button", { name: "Supprimer la session" }).click();
    await page
      .getByRole("button", { name: "Supprimer", exact: true })
      .click();

    await expect(page).toHaveURL(/\/historique$/);
    const rowCountAfter = await page.getByRole("link", { name: /Modifier/ }).count();
    expect(rowCountAfter).toBe(rowCountBefore - 1);
  });

  test("no horizontal scroll on the edit screen, dialog open included — the date-naming title is this story's longest text", async ({
    page,
  }) => {
    await page.goto("/historique");
    await page.getByRole("link", { name: /Modifier/ }).first().click();

    const scrolledClosed = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(scrolledClosed).toBe(false);

    await page.getByRole("button", { name: "Supprimer la session" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();

    const scrolledOpen = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(scrolledOpen).toBe(false);
  });
});
