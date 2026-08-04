// @vitest-environment node
//
// next/experimental/testing/server's unstable_doesMiddlewareMatch (the
// installed package's actual export name — the bundled docs at
// node_modules/next/dist/docs/.../proxy.md:703 call it
// unstable_doesProxyMatch, which this version does not export) relies on a
// global AsyncLocalStorage that Next normally polyfills at process
// bootstrap. Outside a real `next dev`/`next build` runtime — i.e. under
// Vitest — it's unset, and importing the module throws "Invariant:
// AsyncLocalStorage accessed in runtime where it is not available".
// Polyfilling it with Node's own implementation is enough; nothing here
// actually needs cross-async-boundary context.
import { AsyncLocalStorage } from "node:async_hooks";
import { describe, expect, it } from "vitest";

(
  globalThis as typeof globalThis & { AsyncLocalStorage?: typeof AsyncLocalStorage }
).AsyncLocalStorage ??= AsyncLocalStorage;

describe("src/proxy.ts matcher", () => {
  it("excludes /api/health and /api/session, includes the magic-link return route and protected pages, excludes static assets", async () => {
    const { unstable_doesMiddlewareMatch } = await import(
      "next/experimental/testing/server"
    );
    const { config } = await import("./proxy");

    const matches = (url: string) =>
      unstable_doesMiddlewareMatch({ config, url });

    // research Trap 2 / plan decision 6: auth.middleware() redirects (307)
    // instead of returning 401. Running the proxy on these would break s01
    // acceptance criterion 6, which the route handlers already produce
    // correctly on their own.
    expect(matches("/api/health")).toBe(false);
    expect(matches("/api/session")).toBe(false);

    // research "Échange de session au retour du lien": /auth/callback is
    // where needsSessionVerification() + exchangeOAuthToken() run — absent
    // from the matcher, a clicked magic link never gets its session cookies
    // set.
    expect(matches("/auth/callback")).toBe(true);

    // /api/auth/** must stay covered — it's the SDK's own proxied handler
    // (task 4), not something to exclude alongside the other API routes.
    expect(matches("/api/auth/sign-in/magic-link")).toBe(true);

    // Protected app routes still need the proxy to run.
    expect(matches("/")).toBe(true);

    // Static assets: excluded for cost (research Trap 15), not correctness
    // — running the proxy there would add a network round-trip to every
    // asset request for no security benefit.
    expect(matches("/_next/static/chunk.js")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
  });

  // s10 plan task 6, trap 5: the Neon Auth proxy's only sanction is an
  // HTML redirect — on /serwist/sw.js that produces an invalid script
  // and a SILENT registration failure; on /manifest.webmanifest it
  // breaks installability outright. Extended, not duplicated: the same
  // matcher, four more exclusions.
  it("excludes the manifest, the service worker route, the icons, the silhouettes and /~offline — all reachable without a session", async () => {
    const { unstable_doesMiddlewareMatch } = await import(
      "next/experimental/testing/server"
    );
    const { config } = await import("./proxy");

    const matches = (url: string) =>
      unstable_doesMiddlewareMatch({ config, url });

    expect(matches("/manifest.webmanifest")).toBe(false);
    expect(matches("/serwist/sw.js")).toBe(false);
    expect(matches("/icons/icon-192.png")).toBe(false);
    // ADR 020: served to an <img>. The proxy's only sanction is an HTML
    // redirect, and an HTML redirect in an <img> is a broken image —
    // reproduced as a real 307 in production before this exclusion.
    expect(matches("/silhouettes/homme.svg")).toBe(false);
    expect(matches("/silhouettes/femme.svg")).toBe(false);
    expect(matches("/~offline")).toBe(false);

    // Non-regression: everything already excluded/included stays that way.
    expect(matches("/")).toBe(true);
    expect(matches("/api/health")).toBe(false);
    expect(matches("/auth/callback")).toBe(true);
  });
});
