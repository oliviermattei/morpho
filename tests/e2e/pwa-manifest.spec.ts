import { expect, test } from "@playwright/test";

// s10 plan task 8: what is REALLY emitted and served — never mocked,
// never asserted only on the exported config objects (that's
// src/app/manifest.test.ts's job). Every path here is reachable WITHOUT
// a session (src/proxy.ts's extended matcher, task 6) — this is the
// only proof that trap 5 (a redirect on these paths breaks
// installability or silently fails SW registration) never happened.
test.describe("PWA manifest, icons, iOS tags and the service worker route — no session required", () => {
  test("/manifest.webmanifest responds 200, application/manifest+json, and parses as standalone", async ({
    request,
  }) => {
    const response = await request.get("/manifest.webmanifest");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain(
      "application/manifest+json",
    );

    const manifest = await response.json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.id).toBe("/");
    expect(manifest.start_url).toBe("/");
    expect(manifest.theme_color).toBe("#0a0a0a");
  });

  test("every icon declared in the manifest responds 200", async ({
    request,
  }) => {
    const manifestResponse = await request.get("/manifest.webmanifest");
    const manifest = await manifestResponse.json();

    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons as { src: string }[]) {
      const iconResponse = await request.get(icon.src);
      expect(iconResponse.status(), icon.src).toBe(200);
    }
  });

  test("the sign-in page's HTML carries <link rel=manifest>, both *-web-app-capable tags, and light/dark theme-color", async ({
    page,
  }) => {
    // /auth/sign-in is reachable without a session — the manifest and
    // iOS metadata are declared on the root layout, present everywhere.
    await page.goto("/auth/sign-in");

    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );

    const modernTag = page.locator('meta[name="mobile-web-app-capable"]');
    await expect(modernTag).toHaveAttribute("content", "yes");

    const legacyTag = page.locator(
      'meta[name="apple-mobile-web-app-capable"]',
    );
    await expect(legacyTag).toHaveAttribute("content", "yes");

    const lightTheme = page.locator(
      'meta[name="theme-color"][media="(prefers-color-scheme: light)"]',
    );
    await expect(lightTheme).toHaveAttribute("content", "#ffffff");

    const darkTheme = page.locator(
      'meta[name="theme-color"][media="(prefers-color-scheme: dark)"]',
    );
    await expect(darkTheme).toHaveAttribute("content", "#0a0a0a");
  });

  test("/serwist/sw.js responds 200 with Service-Worker-Allowed: /", async ({
    request,
  }) => {
    const response = await request.get("/serwist/sw.js");

    expect(response.status()).toBe(200);
    expect(response.headers()["service-worker-allowed"]).toBe("/");
  });
});
