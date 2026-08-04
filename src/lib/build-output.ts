import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// s01 acceptance criterion 6, moved here by s10 task 8 rather than
// duplicated: the sw.js body scan (src/build-leak.test.ts, the new
// "no third-party tracker" check on the prerendered service worker
// body) needs the SAME list — a second, hand-copied one would
// inevitably drift (the story's own named trap: the first draft of this
// story used bare words like "segment"/"sentry", which collide with
// Next's own internals — "route segments" — instead of the qualified
// domains/package names below).
export const THIRD_PARTY_TRACKERS = [
  "google-analytics.com",
  "googletagmanager.com",
  "segment.com",
  "plausible.io",
  "sentry.io",
  "hotjar.com",
  "@vercel/analytics",
  "@vercel/speed-insights",
];

// s01 acceptance criteria 5 & 6 share this scan: .next/static/** in full,
// plus the HTML and RSC payloads under .next/server/app/** — both of which
// ship to the browser (research Trap 3: a secret leaks into prerendered
// HTML, not just static JS chunks).
const DEFAULT_NEXT_DIR = resolve(import.meta.dirname, "..", "..", ".next");

function collectFiles(
  dir: string,
  predicate: (path: string) => boolean,
): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, predicate));
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Lists the exact scope both build-scanning checks (criteria 5 and 6) read:
 * .next/static/** in full, plus .next/server/app/**\/*.html and *.rsc.
 *
 * Throws — never returns an empty array silently — both when `.next/` is
 * missing entirely and when it exists but has nothing to scan. The second
 * case is review s01 second-pass finding B: a `.next/` left behind by
 * `next dev` or an interrupted build contains only `cache/`, no `static/`
 * or `server/app/`. `existsSync(nextDir)` alone is true for that directory,
 * so the caller would scan zero files and a check built on
 * `expect(offenders).toEqual([])` would pass having proven nothing — the
 * exact vacuous pass both ADR 005's amendment and this function's callers
 * promise never happens on a check that certifies a security criterion.
 *
 * `nextDir` defaults to the project's real `.next/` and is only overridden
 * by tests.
 */
export function collectBuildOutputFiles(
  nextDir: string = DEFAULT_NEXT_DIR,
): string[] {
  if (!existsSync(nextDir)) {
    throw new Error(
      `No build found at ${nextDir}. This check reads production build ` +
        "output, it does not produce it — run `rm -rf .next && npm run " +
        "build` first.",
    );
  }

  const staticFiles = collectFiles(join(nextDir, "static"), () => true);
  const serverFiles = collectFiles(
    join(nextDir, "server", "app"),
    (path) => path.endsWith(".html") || path.endsWith(".rsc"),
  );
  const files = [...staticFiles, ...serverFiles];

  if (files.length === 0) {
    throw new Error(
      `${nextDir} exists but has nothing to scan (no static/ or ` +
        "server/app/**/*.html|*.rsc — typically a stale build left by " +
        "`next dev` or an interrupted `next build`, which only writes " +
        "cache/). Run `rm -rf .next && npm run build` and retry: scanning " +
        "zero files proves nothing.",
    );
  }

  return files;
}
