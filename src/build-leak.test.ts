import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { THIRD_PARTY_TRACKERS, collectBuildOutputFiles } from "./lib/build-output";

// s01 acceptance criterion 6. Needs no secret — unlike criterion 5's
// connection-string check (moved to src/build-connection-leak.check.ts,
// review finding 3), this test stays in `npm run test` / `npm run check`.
//
// research Trap 3: the leak vector is NOT where it looks. A non-NEXT_PUBLIC_
// secret never reaches .next/static/*.js, but leaks in full into
// prerendered HTML — a "use client" component is still rendered
// server-side at build time, and whatever process.env holds then gets
// frozen into that HTML. Scanning only .next/static/ is a false pass. This
// test also reads .next/server/app/**/*.html and **/*.rsc.
//
// research Trap 4: a stale .next/ gives contradictory results — chunk names
// are content-hashed. Review s01 second-pass finding B: the previous
// version only rebuilt when .next/ was ABSENT, so a stale .next/ left over
// from an earlier commit (or from `next dev`) was scanned as if fresh —
// exactly the trap this comment already warned about, three lines above the
// code that ignored it. Always rebuild instead: a fresh `next build` here
// takes ~5s, cheap enough to pay on every run and the only way to guarantee
// the scanned output matches the current source.
const ROOT_DIR = resolve(import.meta.dirname, "..");

// collectBuildOutputFiles() (src/lib/build-output.ts) throws rather than
// returning [] when there is nothing to scan — the other half of finding B:
// a `.next/` containing only `cache/` (left by `next dev` or an interrupted
// build) made this check pass having scanned zero files.

// s10 plan task 8: THIRD_PARTY_TRACKERS itself moved to
// src/lib/build-output.ts (imported above) so this file and the sw.js
// body scan below share the ONE list — never a second, hand-copied one.
const SW_JS_BODY_FILE = resolve(
  import.meta.dirname,
  "..",
  ".next",
  "server",
  "app",
  "serwist",
  "sw.js.body",
);

// serwist@9.5.12 embeds initializeGoogleAnalytics in the Serwist
// constructor behind a runtime condition on offlineAnalyticsConfig — a
// branch tree-shaking cannot resolve. Both Google needles ARE present in
// the built sw.js body, unavoidably; the assertion below is refounded to
// prove what's actually observable: no NON-Google tracker is reachable.
// Real tracking (no dependency added, no request to a third party) is
// asserted at the network level in tests/e2e/pwa-offline.spec.ts (task 9)
// — see docs/prd.md criterion 11.
const NON_GOOGLE_TRACKERS = THIRD_PARTY_TRACKERS.filter(
  (needle) => !needle.includes("google"),
);

describe("build output — no third-party trackers (criterion 6)", () => {
  beforeAll(() => {
    // No secret is required to build morpho (getSql()/getAuth() are lazy —
    // s01 criteria 1 & the build in "What I ran myself" of the review both
    // confirm this) — so rebuilding here, on demand, keeps this check
    // self-sufficient rather than depending on script ordering elsewhere,
    // and always fresh (finding B).
    execSync("rm -rf .next && npx next build", {
      cwd: ROOT_DIR,
      stdio: "inherit",
    });
  }, 60_000);

  it("contains no analytics or tracker reference in static assets or prerendered HTML/RSC", () => {
    const offenders: { file: string; needle: string }[] = [];

    for (const file of collectBuildOutputFiles()) {
      const content = readFileSync(file, "utf8");
      for (const needle of THIRD_PARTY_TRACKERS) {
        if (content.includes(needle)) {
          offenders.push({ file, needle });
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  // s10 plan task 8: collectBuildOutputFiles() reads .html and .rsc under
  // .next/server/app/**, never .body files — so /serwist/sw.js's
  // prerendered body (a route with generateStaticParams) is NEVER
  // covered by the check above. Scanned explicitly here, against the
  // NON-Google subset only: the two Google needles are unavoidably
  // present (see the comment above this describe block) and are not a
  // failure of this check.
  it("the prerendered /serwist/sw.js body carries no NON-Google tracker reference", () => {
    const content = readFileSync(SW_JS_BODY_FILE, "utf8");
    const offenders = NON_GOOGLE_TRACKERS.filter((needle) =>
      content.includes(needle),
    );

    expect(offenders).toEqual([]);
  });

  // The flip side, so this test can never pass by accident on an empty
  // or wrong file: the body really does contain the SW's real code.
  it("the sw.js body file actually exists and contains real service worker code", () => {
    const content = readFileSync(SW_JS_BODY_FILE, "utf8");
    expect(content.length).toBeGreaterThan(1000);
    expect(content).toContain("serwist");
  });
});
