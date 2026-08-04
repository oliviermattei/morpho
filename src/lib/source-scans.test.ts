// @vitest-environment node
//
// Mechanical guard-rails named by the s06 plan's test strategy: source
// scans that catch a second, divergent implementation of a rule this
// repo intends to have exactly once. Grown task by task — task 2 adds
// the Intl.NumberFormat scan, task 4 adds the verdict-assignment scan.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = resolve(import.meta.dirname, "..");

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) {
      return [];
    }
    return [fullPath];
  });
}

const SOURCE_FILES = collectSourceFiles(SRC_DIR);

// Plan s06 task 2: formatFrenchNumber (src/lib/format-number.ts) is the
// single French-number rounding rule in the project. A second
// `new Intl.NumberFormat` anywhere else would be a second, divergent
// rounding rule — exactly what P2 (s04) and this scan exist to prevent.
describe("new Intl.NumberFormat — exactly one construction site", () => {
  const FORMAT_NUMBER_FILE = resolve(SRC_DIR, "lib", "format-number.ts");

  it.each(SOURCE_FILES.filter((file) => file !== FORMAT_NUMBER_FILE))(
    "%s never constructs its own Intl.NumberFormat",
    (file) => {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("new Intl.NumberFormat");
    },
  );

  it("format-number.ts is the one file that does", () => {
    const source = readFileSync(FORMAT_NUMBER_FILE, "utf8");
    expect(source).toContain("new Intl.NumberFormat");
  });
});

// Plan s06 task 4, decision 19: only formatMeasurementDelta
// (measurements.ts) and buildBodyMapView (body-map-view.ts) may assign a
// verdict. Every other file — the components that render it — must only
// ever read a `verdict` they were handed, never compute one.
describe("verdict: — assigned in exactly two modules", () => {
  const ALLOWED_FILES = [
    resolve(SRC_DIR, "lib", "measurements.ts"),
    resolve(SRC_DIR, "lib", "body-map-view.ts"),
  ];
  // Matches a `verdict:` object-literal property assigned a literal
  // verdict string, or a ternary/comparison that would compute one from
  // a delta's sign — the actual anti-pattern (a hardcoded verdict, or
  // `delta < 0 ? "favorable" : "adverse"`). Deliberately narrower than
  // "any `verdict:`": a component's own props-interface declaration
  // (`verdict: MeasurementVerdict | null`) or a `verdict={entry.verdict}`
  // pass-through must not trip this — those aren't assignments of a
  // computed verdict, they're a type or a read.
  const VERDICT_ASSIGNMENT_PATTERN =
    /verdict:\s*(?:"(?:favorable|adverse|neutral)"|delta\s*[<>])/;

  it.each(SOURCE_FILES.filter((file) => !ALLOWED_FILES.includes(file)))(
    "%s never assigns a verdict: property",
    (file) => {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(VERDICT_ASSIGNMENT_PATTERN);
    },
  );
});

// s09 plan task 9, R11: the accueil/historique/graphes read path relies
// on `force-dynamic` + no server cache to make R10's "no revalidatePath"
// safe (staleTimes.dynamic is 0 — every navigation refetches on its
// own). `unstable_cache` or the `"use cache"` directive on any of these
// five files would silently reintroduce a server cache entry that a
// mutation never invalidates: a corrected or deleted session would keep
// showing its old value. React's `cache()` is explicitly ALLOWED (Next's
// own bundled docs recommend it for exactly this read path, "Deduplicating
// requests" — it deduplicates within one render pass, it never persists
// across requests or mutations, unlike the two patterns above).
describe("read path — no server-persisted cache (s09 R11)", () => {
  const GUARDED_FILES = [
    resolve(SRC_DIR, "lib", "measurement-sessions.ts"),
    resolve(SRC_DIR, "lib", "db", "latest-measurements.ts"),
    resolve(SRC_DIR, "lib", "db", "body-map.ts"),
    resolve(SRC_DIR, "lib", "db", "measurement-series.ts"),
    resolve(SRC_DIR, "lib", "db", "sessions.ts"),
  ];

  // A named, non-empty list resolved on disk — never a glob that could
  // silently miss the exact files a mutation invalidates the freshness
  // of. Fails loudly (not vacuously) if the list is empty or a listed
  // file doesn't exist, rather than passing every it.each with zero
  // iterations.
  it("names a non-empty list of files, and every one of them exists on disk", () => {
    expect(GUARDED_FILES.length).toBeGreaterThan(0);
    for (const file of GUARDED_FILES) {
      expect(existsSync(file)).toBe(true);
    }
  });

  // A module-scope memoization variable — `const cache = new Map()`,
  // `let cached = …` — is the same class of bug as unstable_cache: a
  // value that survives past the render pass it was read in. React's
  // own cache() is a function CALL, not a variable declaration, so this
  // pattern doesn't trip on it.
  const MODULE_SCOPE_MEMOIZATION_PATTERN =
    /^(export )?(const|let)\s+\w*[Cc]ach(e|ed)\w*\s*=/m;

  it.each(GUARDED_FILES)(
    "%s never imports unstable_cache, the 'use cache' directive, or a module-scope cache variable",
    (file) => {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("unstable_cache");
      expect(source).not.toContain('"use cache"');
      expect(source).not.toMatch(MODULE_SCOPE_MEMOIZATION_PATTERN);
    },
  );
});

// s10 plan task 5, decisions 2 and 8: src/app/sw.ts is hand-written
// routing (never defaultCache — the persistent-cache-by-construction
// decision 2 rejects) and never enables offlineAnalyticsConfig, the ONE
// switch that would make Serwist's embedded (otherwise dead) Google
// Analytics code reachable (task 8). Read directly on the source, not
// inferred from behavior — this is what fails loudly if a future change
// reintroduces either.
describe("src/app/sw.ts — never defaultCache, never offlineAnalyticsConfig (s10 task 5)", () => {
  const SW_FILE = resolve(SRC_DIR, "app", "sw.ts");

  it("the file exists", () => {
    expect(existsSync(SW_FILE)).toBe(true);
  });

  it("never imports or references defaultCache", () => {
    const source = readFileSync(SW_FILE, "utf8");
    expect(source).not.toContain("defaultCache");
  });

  it("never sets offlineAnalyticsConfig", () => {
    const source = readFileSync(SW_FILE, "utf8");
    expect(source).not.toContain("offlineAnalyticsConfig");
  });
});
