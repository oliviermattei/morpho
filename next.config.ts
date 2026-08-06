import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

/**
 * s10 plan task 2, ADR 018, decision 9: the additive `headers()` rule
 * below is an EXPLICIT safety net, not a duplicate of what
 * createSerwistRoute's own GET handler already sets
 * (@serwist/turbopack@9.5.12, src/index.ts: `"Service-Worker-Allowed":
 * "/"`) — if Vercel's prerendering pipeline ever drops that header, the
 * service worker's registration fails with a SecurityError and offline
 * never works again, silently. `cacheComponents` stays OFF (trap 10):
 * createSerwistRoute exports `dynamic`/`dynamicParams`/`revalidate`
 * (task 5), all three dropped the instant Cache Components is active.
 */
const nextConfig: NextConfig = {
  // The dev overlay badge sits bottom-left, exactly where this app's own
  // chrome lives, and every screenshot of a mobile viewport has it stamped
  // over the content. Turning it off costs nothing: compile and runtime
  // errors are still surfaced full-screen, only the idle indicator goes.
  devIndicators: false,
  headers: async () => [
    {
      source: "/serwist/:path*",
      headers: [
        { key: "Service-Worker-Allowed", value: "/" },
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
      ],
    },
  ],
};

export default withSerwist(nextConfig);
