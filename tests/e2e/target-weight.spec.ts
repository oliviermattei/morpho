import { expect, test } from "@playwright/test";

// Plan s08 task 9, project "mobile" (375x812, s01's playwright.config.ts).
test.describe("unauthenticated visitors are redirected to sign-in", () => {
  test("/profil redirects to the sign-in screen even with a target-weight-shaped deep link", async ({
    page,
  }) => {
    await page.goto("/profil");

    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});

// ADR 011's globalSetup opens the session for real (magic link, token
// read from neon_auth.verification) — nothing on this branch wires it
// up (no tests/e2e/global-setup.* exists), and this execution must not
// send a real magic-link email. Same skip convention as
// tests/e2e/graphes.spec.ts and tests/e2e/saisie.spec.ts: explicit
// message, never a silently-passing test.
test.describe("authenticated — target weight (criteria 1, 2, 3, 4)", () => {
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

  // Seeded through the app's own screens, never a direct DB insert
  // (plan's own rejected option: it would open a second write path in
  // the harness, bypass server validation, and need its own cleanup).
  // Recording a weight session via /saisie also proves criterion 1's
  // "persisted" half for the number the target is compared against.
  async function seedWeightSession(page: import("@playwright/test").Page) {
    await page.goto("/saisie");
    await page.getByLabel(/poids/i).first().fill("74,1");
    await page.getByRole("button", { name: /enregistrer/i }).click();
    await expect(page).toHaveURL(/\/(historique)?$/);
  }

  async function setTarget(page: import("@playwright/test").Page, raw: string) {
    await page.goto("/profil");
    const field = page.getByLabel("Poids cible (kg)");
    await field.fill(raw);
    await page.getByRole("button", { name: /enregistrer/i }).click();
    await expect(page.getByText(/poids cible/i)).toBeVisible();
  }

  test("criterion 1: a target set from the profile is persisted across a full reload", async ({
    page,
  }) => {
    await setTarget(page, "72");

    await page.reload();

    await expect(page.getByLabel("Poids cible (kg)")).toHaveValue("72");
  });

  test("criteria 2 and 3: the graph shows the reference line and the gap row, with the label contained in the chart", async ({
    page,
  }) => {
    await seedWeightSession(page);
    await setTarget(page, "72");

    await page.goto("/graphes");

    await expect(page.getByText(/écart/)).toBeVisible();

    const surface = page.locator(".recharts-surface");
    const label = page.locator("text.recharts-label");
    await expect(label).toBeVisible();

    // Assertion written to actually fail: a <text> clipped by the SVG's
    // own overflow:hidden keeps a non-empty bounding box and would still
    // pass a bare toBeVisible() check (plan's own named trap) — this
    // compares the label's box against the chart surface's and requires
    // inclusion, not mere presence.
    const surfaceBox = await surface.boundingBox();
    const labelBox = await label.boundingBox();
    expect(surfaceBox).not.toBeNull();
    expect(labelBox).not.toBeNull();
    if (surfaceBox && labelBox) {
      expect(labelBox.x).toBeGreaterThanOrEqual(surfaceBox.x);
      expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(
        surfaceBox.x + surfaceBox.width + 1, // sub-pixel rounding
      );
    }

    const hasHorizontalScroll = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test("switching to another measure hides the row and the reference line", async ({
    page,
  }) => {
    await seedWeightSession(page);
    await setTarget(page, "72");
    await page.goto("/graphes");
    await expect(page.getByText(/écart/)).toBeVisible();

    await page.getByRole("combobox", { name: "Mesure" }).click();
    await page.getByRole("option", { name: "IMC" }).click();

    await expect(page.getByText(/écart/)).not.toBeVisible();
    await expect(page.locator(".recharts-reference-line")).toHaveCount(0);
  });

  // Criterion 4, and this test's own cleanup: emptying the field is the
  // only path back to "no target".
  test("criterion 4: clearing the target from /profil removes the row and the line on the graph", async ({
    page,
  }) => {
    await seedWeightSession(page);
    await setTarget(page, "72");

    await page.goto("/profil");
    await page.getByLabel("Poids cible (kg)").fill("");
    await page.getByRole("button", { name: /enregistrer/i }).click();
    await expect(page.getByText(/poids cible/i)).toBeVisible();

    await page.goto("/graphes");

    await expect(page.getByText(/écart/)).not.toBeVisible();
    await expect(page.locator(".recharts-reference-line")).toHaveCount(0);
  });

  // §Points escaladés E-A / ADR 013: measured, never blind-fixed. The
  // result — whatever it is — belongs in the review, not a correctif
  // improvised in this story.
  test("back-navigation after setting a target — measured, not fixed (ADR 013)", async ({
    page,
  }) => {
    await seedWeightSession(page);
    await page.goto("/graphes");

    await page.goto("/profil");
    await setTarget(page, "72");

    await page.goBack();

    // No assertion of a specific outcome here on purpose: ADR 013
    // accepts a stale back-navigation screen project-wide. This test's
    // only job is to make the actual behaviour observable for the
    // review to record — whether the reference line is present or not
    // after goBack() is the finding, not a pass/fail condition.
    const referenceLineCountAfterBack = await page
      .locator(".recharts-reference-line")
      .count();
    test.info().annotations.push({
      type: "ADR-013-measurement",
      description: `reference line count after goBack(): ${referenceLineCountAfterBack}`,
    });
  });
});
