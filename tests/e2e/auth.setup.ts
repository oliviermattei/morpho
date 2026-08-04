import { expect, test as setup } from "@playwright/test";
import path from "node:path";

/**
 * ADR 019 replaces the magic link with email + password, which is what
 * finally makes this file possible. ADR 011's original plan was a
 * globalSetup calling `authClient.signIn.magicLink()` for real — it was
 * never wired, because opening a session that way sends a real email to a
 * real mailbox and then needs a human to click the link. Every
 * session-dependent e2e check was left unautomated as a result (see the
 * skip notes in profil.spec.ts, target-weight.spec.ts,
 * historique-edition.spec.ts, pwa-offline.spec.ts).
 *
 * With a password there is nothing to click: this signs in through the real
 * UI, against the real auth server, and saves the resulting cookies as a
 * Playwright storageState the authenticated project reuses.
 *
 * Credentials come from E2E_EMAIL / E2E_PASSWORD. When they are absent the
 * authenticated project is not registered at all (playwright.config.ts), so
 * this file never runs half-configured.
 */
export const STORAGE_STATE = path.join(
  __dirname,
  ".auth",
  "user.json",
);

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  // Defensive: playwright.config.ts already gates on these. Failing loudly
  // beats writing an anonymous storageState that would make every
  // authenticated spec fail with a confusing redirect instead.
  if (!email || !password) {
    throw new Error("E2E_EMAIL and E2E_PASSWORD must both be set");
  }

  await page.goto("/auth/sign-in");
  await page.getByLabel("Adresse email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  // The redirect off /auth/sign-in is the proof the session cookies landed.
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/"), {
    timeout: 30_000,
  });

  // And the server agrees, not just the client router.
  const response = await page.request.get("/api/session");
  expect(response.status()).toBe(200);
  expect((await response.json()).user.email).toBe(email);

  await page.context().storageState({ path: STORAGE_STATE });
});
