import { expect, test } from "@playwright/test";

// s10 plan task 9(a): the offline behavior itself — service worker
// registration, the morpho-user- caches actually appearing and being
// purged, the /~offline fallback, and the zero-Google-request proof
// (criterion 11 / docs/prd.md). Two preconditions, BOTH required, and
// this execution is explicitly forbidden from creating either by
// itself:
//
// 1. E2E_PROD=1 — trap 13: under `npm run dev`, @serwist/turbopack
//    forces disablePrecacheManifest and an empty
//    additionalPrecacheEntries, so this spec would validate an illusion
//    if it ran there. `npm run test:e2e:pwa` sets this.
// 2. E2E_STORAGE_STATE — a real authenticated session, exactly like
//    tests/e2e/historique-edition.spec.ts, body-map.spec.ts,
//    graphes.spec.ts and target-weight.spec.ts (all already merged onto
//    this branch) — a storageState produced once, by hand, after a
//    real magic link. ADR 011's own globalSetup is not wired on this
//    branch (no tests/e2e/global-setup.* exists), and running it for
//    real would send an email, which this execution must not do.
//
// Both gates skip cleanly with an explicit message — never a jsdom
// substitute for what only a real browser, a real service worker and a
// real CacheStorage can prove.
test.describe("offline behavior — service worker, user-cache purge, /~offline, no third-party requests", () => {
  test.skip(
    !process.env.E2E_PROD,
    "E2E_PROD is not set — this spec must run against a production " +
      "build (npm run test:e2e:pwa), never `npm run dev` (trap 13: " +
      "disablePrecacheManifest is forced there, which would make this " +
      "spec validate an illusion).",
  );

  test.skip(
    !process.env.E2E_STORAGE_STATE,
    "E2E_STORAGE_STATE is not set — no session-injection mechanism is " +
      "wired up on this branch yet (ADR 011 documents the approach, " +
      "nothing implements it), and this execution must not send an " +
      "email to run the globalSetup the plan's own text names. See the " +
      "review for what remains NOT VERIFIED and why.",
  );

  test.use({
    storageState: process.env.E2E_STORAGE_STATE,
  });

  test("the service worker registers and controls the page", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
      { timeout: 15_000 },
    );

    const hasController = await page.evaluate(
      () => navigator.serviceWorker.controller !== null,
    );
    expect(hasController).toBe(true);
  });

  // Posed BEFORE the offline assertions below, deliberately: without
  // this, an accidentally-neutralized cache would make every assertion
  // after it TRUE VACUOUSLY (nothing was ever cached, so nothing is
  // found offline either) instead of red.
  test("at least one morpho-user- cache exists after visiting the app online", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Saisir" }).first().waitFor();

    const cacheNames = await page.evaluate(() => caches.keys());
    expect(cacheNames.some((name) => name.startsWith("morpho-user-"))).toBe(
      true,
    );
  });

  test("offline, a previously-visited screen still renders — never the browser's own error page", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Saisir" }).first().waitFor();

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole("link", { name: "Saisir" }).first()).toBeVisible();
    await expect(page.getByText(/hors ligne/i)).toBeVisible();
  });

  test("offline, a route never visited online falls back to /~offline", async ({
    page,
    context,
  }) => {
    await context.setOffline(true);
    await page.goto("/historique/00000000-0000-0000-0000-000000000000");

    await expect(page.getByText(/hors ligne/i)).toBeVisible();
  });

  test("after signing out, no data from the previous session is exposed offline, and the morpho-user- caches are gone", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Saisir" }).first().waitFor();

    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await page.waitForURL(/\/auth\/sign-in/);

    const cacheNamesAfterSignOut = await page.evaluate(() => caches.keys());
    expect(
      cacheNamesAfterSignOut.some((name) => name.startsWith("morpho-user-")),
    ).toBe(false);

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByText(/hors ligne/i)).not.toBeVisible();
  });

  // Criterion 11 / docs/prd.md: real tracking is what's asserted, not a
  // grep — no request ever leaves for a Google analytics domain,
  // despite the two needles' unavoidable presence as dead code in
  // /serwist/sw.js (measured in src/build-leak.test.ts).
  test("zero requests to google-analytics.com or googletagmanager.com", async ({
    page,
  }) => {
    const trackerRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (
        url.includes("google-analytics.com") ||
        url.includes("googletagmanager.com")
      ) {
        trackerRequests.push(url);
      }
    });

    await page.goto("/");
    await page.getByRole("link", { name: "Saisir" }).first().click();
    await page.waitForURL(/\/saisie/);

    expect(trackerRequests).toEqual([]);
  });
});
