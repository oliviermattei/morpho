import { expect, test } from "@playwright/test";

// Plan s06 task 9, project "mobile" (already forced to 375x812 by s01,
// verified in playwright.config.ts — not re-overridden here).
test.describe("unauthenticated visitors are redirected to sign-in", () => {
  test("/ redirects to the sign-in screen", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});

// Decision 16: the session-injection mechanism (storageState via
// E2E_STORAGE_STATE) is documented — ADR 011,
// docs/decisions/011-e2e-session-via-verification-table.md, accepted —
// but nothing on this branch implements the globalSetup it describes
// (no tests/e2e/global-setup.* exists), and this execution must not
// send any email, which is exactly what running that setup would do.
// So this block skips cleanly, with an explicit message — never a
// jsdom substitute for what can only be measured in a real browser
// (font-size actually computed, an element's real bounding box), and
// never a silently-passing test.skip.
test.describe("authenticated — 375px, 12px labels, 44px targets, one tap (criteria 7, 8)", () => {
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

  test("no horizontal scroll and no element overflows the 375px viewport", async ({
    page,
  }) => {
    await page.goto("/");

    const hasHorizontalScroll = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test("the 7 zone labels are rendered at a computed font-size >= 12px", async ({
    page,
  }) => {
    await page.goto("/");

    const fontSizes = await page.$$eval("[data-zone-name]", (nodes) =>
      nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)),
    );
    expect(fontSizes).toHaveLength(7);
    for (const size of fontSizes) {
      expect(size).toBeGreaterThanOrEqual(12);
    }
  });

  test("the header's Saisir button is at least 44px tall", async ({
    page,
  }) => {
    await page.goto("/");

    const box = await page
      .getByRole("link", { name: "Saisir" })
      .first()
      .boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test("a single tap from the home screen reaches /saisie (criterion 8, s05 non-regression)", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Saisir" }).first().click();

    await expect(page).toHaveURL(/\/saisie/);
  });
});
