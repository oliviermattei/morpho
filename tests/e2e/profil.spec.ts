import { expect, test } from "@playwright/test";

// Plan task 10. Unconditional part: redirection for an anonymous
// visitor, the same motif as tests/e2e/saisie.spec.ts. /profil sits
// behind src/proxy.ts and the page's own session guard (defense in
// depth) — this exercises the redirect for real, in a real browser.
//
// The conditional part (§Décisions au-dessus de ce plan, point 3; ADR
// 011) — no horizontal scroll at 375px, the four controls at >= 44px,
// light/dark rendering — needs a real authenticated session. ADR 011's
// globalSetup opens one by calling authClient.signIn.magicLink() for
// real, which sends a real email — explicitly out of scope for this
// execution (no email is sent to any address). That capacity is not
// wired up here: these three checks are NOT automated, and are not
// replaced by a jsdom class assertion. See the review for the manual
// protocol that covers them instead.
test.describe("unauthenticated visitors are redirected to sign-in", () => {
  test("/profil redirects to the sign-in screen", async ({ page }) => {
    await page.goto("/profil");

    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});
