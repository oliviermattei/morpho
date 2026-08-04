import { expect, test } from "@playwright/test";

/**
 * ADR 019. The first e2e spec in this project that runs with a real
 * session: it inherits the storageState written by auth.setup.ts, which
 * signed in with a password against the real Neon Auth server. Registered
 * only when E2E_EMAIL / E2E_PASSWORD are set (playwright.config.ts).
 *
 * `*.auth.spec.ts` is the naming convention for "needs a session" — the
 * anonymous projects (mobile, desktop) ignore that suffix, so these never
 * run without one and never produce a misleading redirect failure.
 */
test.describe("an authenticated session", () => {
  test("opens the home screen instead of the sign-in screen", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).not.toHaveURL(/\/auth\/sign-in/);
    // ADR 020 replaced AppHeader's "Menu" dropdown with the permanent
    // bottom bar — that landmark is the proof the authenticated tree
    // rendered, not the sign-in screen.
    await expect(
      page.getByRole("navigation", { name: "Navigation principale" }),
    ).toBeVisible();
  });

  test("is recognised server-side by /api/session", async ({ request }) => {
    const response = await request.get("/api/session");

    expect(response.status()).toBe(200);
    const body = await response.json();
    // Identity comes from the verified session token, never from the
    // client (morpho/AGENTS.md).
    expect(body.user.email).toBe(process.env.E2E_EMAIL);
    expect(body.user.id).toEqual(expect.any(String));
  });

  test("reaches the protected pages without a redirect", async ({ page }) => {
    for (const route of ["/profil", "/saisie", "/historique", "/graphes"]) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route}$`));
    }
  });

});

/**
 * Sign-out revokes the session on the auth server, not just in this
 * browser context — running it against the SHARED storageState would pull
 * the session out from under every other spec in this project, which run in
 * parallel (`fullyParallel: true`). Observed as a real, reproducible
 * failure, not a theoretical one.
 *
 * So this block starts anonymous and opens its own session through the UI.
 * It covers the full round trip — sign in, sign out, stay out — and leaves
 * the shared session untouched.
 */
test.describe("the sign-in / sign-out round trip", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("signs in, signs out, and a reload does not restore the session", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/sign-in/);

    await page.getByLabel("Adresse email").fill(process.env.E2E_EMAIL!);
    await page.getByLabel("Mot de passe").fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(
      page.getByRole("navigation", { name: "Navigation principale" }),
    ).toBeVisible();

    // ADR 020: sign-out moved out of AppHeader's dropdown and onto
    // /profil, reached from the bottom bar. No dropdown to open any
    // more, so no hydration retry loop either — but the button is still
    // a client component, hence the generous visibility wait.
    await page.getByRole("link", { name: "Profil" }).click();
    await page.waitForURL(/\/profil/);

    const logout = page.getByRole("button", { name: "Se déconnecter" });
    await expect(logout).toBeVisible({ timeout: 20_000 });
    await expect(async () => {
      await logout.click();
      await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 5_000 });
    }).toPass({ timeout: 25_000 });

    await expect(page).toHaveURL(/\/auth\/sign-in/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});
