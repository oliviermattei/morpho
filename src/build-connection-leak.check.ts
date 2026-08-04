import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collectBuildOutputFiles } from "./lib/build-output";

// s01 acceptance criterion 5. Review finding 3: a green `npm run check`
// must be reachable without secrets, in any environment (CI, a fresh
// clone) — that is the very gate the pipeline relies on for every later
// story. This test needs a real DATABASE_URL and a build made with it, so
// it does NOT run as part of `npm run test` / `npm run check` (it is
// excluded by the default `include` glob in vitest.config.mts, which only
// picks up `*.test.ts`). It runs exclusively via `npm run check:leak`
// (vitest.leak.config.mts), which the review replays on a populated build —
// see docs/plans/s01-deploy-skeleton.md, "Protocole du critère 5".
//
// research Trap 3: the leak vector is NOT where it looks. A non-NEXT_PUBLIC_
// secret never reaches .next/static/*.js, but leaks in full into
// prerendered HTML — a "use client" component is still rendered
// server-side at build time, and whatever process.env holds then gets
// frozen into that HTML. Scanning only .next/static/ is a false pass. This
// test also reads .next/server/app/**/*.html and **/*.rsc.
//
// research Trap 4: a stale .next/ gives contradictory results — chunk names
// are content-hashed, so always rebuild with `rm -rf .next` first.
//
// collectBuildOutputFiles() (src/lib/build-output.ts) throws rather than
// returning [] when there is nothing to scan — review s01 second-pass
// finding B: a `.next/` left behind by `next dev` or an interrupted build
// contains only `cache/`, which made this check pass having scanned zero
// files.
//
// s02 review finding 4: this check only ever looked for DATABASE_URL and
// its components. s02 introduced a second server secret
// (NEON_AUTH_COOKIE_SECRET) and the project's first statically prerendered
// page carrying a "use client" component (/auth/sign-in, `○` in the build
// output) — exactly the Trap 3 shape this file scans for. Without the
// secret in the needle set, a leak of it would never be caught; without
// requiring it to be set, an environment missing the var would make this
// check pass vacuously (nothing to search for), which is precisely the
// false-pass this file exists to rule out.

describe("build output — no Neon connection string (criterion 5)", () => {
  it("requires a build made with a populated DATABASE_URL, or fails explicitly", () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is not set. Scanning a build made without a secret " +
          "cannot prove anything about secret leakage — a green result here " +
          "would be a false pass (docs/research/s01-deploy-skeleton.md, " +
          "Trap 3). Populate .env.local, run `rm -rf .next && npm run " +
          "build`, and re-run this test with DATABASE_URL exported.",
      );
    }

    const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

    if (!cookieSecret) {
      throw new Error(
        "NEON_AUTH_COOKIE_SECRET is not set. Same reasoning as DATABASE_URL " +
          "above: scanning for a secret that was never populated in the " +
          "build proves nothing (review s02, finding 4). Populate " +
          ".env.local, run `rm -rf .next && npm run build`, and re-run this " +
          "test with NEON_AUTH_COOKIE_SECRET exported.",
      );
    }

    const parsedUrl = new URL(databaseUrl);
    // Review finding 6 (s01): the password alone, isolated from the rest of
    // the connection string, is the single most sensitive component — a
    // leak of just that value would slip through the previous needle set.
    const needles = [
      "postgres://",
      databaseUrl,
      parsedUrl.host,
      parsedUrl.password,
      // Review finding 4 (s02): the second server secret this story
      // introduced, checked against the same prerendered-HTML/RSC scope —
      // see collectBuildOutputFiles() above for why static/** alone isn't
      // enough.
      cookieSecret,
    ];
    const offenders: { file: string; needle: string }[] = [];

    for (const file of collectBuildOutputFiles()) {
      const content = readFileSync(file, "utf8");
      for (const needle of needles) {
        if (needle && content.includes(needle)) {
          offenders.push({ file, needle });
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
