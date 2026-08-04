import { expect, test } from "@playwright/test";

// Plan task 10: the only browser coverage this story can build without a
// programmatic session-injection mechanism (ADR 011, framing scope, landed
// after s03's own plan was written — see "Ce que ce plan ne tranche pas",
// point 1). /saisie and /historique both sit behind src/proxy.ts and each
// page's own session guard (defense in depth, plan decision 22); this
// exercises the redirect for real, in a real browser, rather than trusting
// it from the unit tests alone.
test.describe("unauthenticated visitors are redirected to sign-in", () => {
  test("/saisie redirects to the sign-in screen", async ({ page }) => {
    await page.goto("/saisie");

    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test("/historique redirects to the sign-in screen", async ({ page }) => {
    await page.goto("/historique");

    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});
