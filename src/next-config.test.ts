// @vitest-environment node
//
// s10 plan task 2: next.config.ts is wrapped in withSerwist(), whose ONLY
// effect (@serwist/turbopack@9.5.12, src/index.ts, read directly) is to
// concatenate `esbuild`/`esbuild-wasm` onto serverExternalPackages — that
// concatenation is the ONE mechanical proof this file passes through the
// wrapper at all; the other two assertions below would stay green even on
// a next.config.ts written by hand, without the wrapper.
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("next.config.ts — withSerwist (s10 task 2)", () => {
  it("passes through withSerwist(): serverExternalPackages carries esbuild and esbuild-wasm", () => {
    expect(nextConfig.serverExternalPackages).toContain("esbuild");
    expect(nextConfig.serverExternalPackages).toContain("esbuild-wasm");
  });

  // Trap 10: createSerwistRoute (task 5) exports dynamic/dynamicParams/
  // revalidate — all three are dropped as soon as cacheComponents is
  // active. This guard is what makes a future story that flips it on
  // fail loudly here, instead of breaking the service worker silently.
  it("never activates cacheComponents", () => {
    expect(nextConfig.experimental?.cacheComponents).not.toBe(true);
  });

  // Decision 9: an explicit safety net for Service-Worker-Allowed — if
  // Vercel's prerendering pipeline ever drops the route handler's own
  // header, registration fails with a SecurityError and offline never
  // works again, silently.
  it("posts Service-Worker-Allowed: / on /serwist/:path* via headers()", async () => {
    const rules = await nextConfig.headers?.();
    const serwistRule = rules?.find((rule) => rule.source === "/serwist/:path*");

    expect(serwistRule).toBeDefined();
    expect(serwistRule?.headers).toContainEqual({
      key: "Service-Worker-Allowed",
      value: "/",
    });
  });
});
