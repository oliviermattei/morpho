// @vitest-environment node
//
// Plan s06 decision 8 bis: the "no literal path" scan is restricted to
// the s06 scope — src/app/(home)/**, AppHeader.tsx, BodyMap.tsx,
// BodyMapLegend.tsx, OffBodyCards.tsx — never the whole repo. s03, s04
// and s05 shipped before routes.ts existed; their own literals (a form's
// router.push("/historique"), src/proxy.ts's LOGIN_URL) are legitimate
// and out of scope here.
//
// Written in task 1, before most of the scanned files exist: existsSync
// skips what isn't there yet, so this test starts passing vacuously and
// gains real teeth as tasks 5-8 add BodyMap.tsx, OffBodyCards.tsx,
// AppHeader.tsx and src/app/(home)/**.
//
// s07 P11 extends the scope to its own new files (src/app/graphes/**,
// MeasurementChart.tsx, MeasurementChartsPanel.tsx, RetryButton.tsx) —
// self-discipline turned into a mechanical guard, the same reasoning
// s06 applied to its own scope rather than the whole repo.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { routes } from "./routes";

const SRC_DIR = resolve(import.meta.dirname, "..");

const SCANNED_PATHS = [
  join(SRC_DIR, "app", "(home)"),
  join(SRC_DIR, "app", "graphes"),
  join(SRC_DIR, "components", "AppHeader.tsx"),
  join(SRC_DIR, "components", "BodyMap.tsx"),
  join(SRC_DIR, "components", "BodyMapLegend.tsx"),
  join(SRC_DIR, "components", "OffBodyCards.tsx"),
  join(SRC_DIR, "components", "MeasurementChart.tsx"),
  join(SRC_DIR, "components", "MeasurementChartsPanel.tsx"),
  join(SRC_DIR, "components", "RetryButton.tsx"),
];

function collectFiles(path: string): string[] {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(path, entry.name);
    return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

const LITERAL_ROUTE_PATTERN = new RegExp(
  `["'\`](?:${[
    routes.entry,
    routes.profile,
    routes.signIn,
    routes.charts,
    routes.history,
  ]
    .map((path) => path.replace(/\//g, "\\/"))
    .join("|")})["'\`]`,
);

describe("s06/s07 scope — no hardcoded route path", () => {
  // Every scanned path recurses the same way, whether it's a single
  // component file or a whole route directory — no longer indexed by
  // position, so a new directory entry (src/app/graphes) doesn't need a
  // parallel special case.
  const files = SCANNED_PATHS.flatMap(collectFiles);

  // Test files are legitimately allowed to assert against a literal
  // expected route (`toHaveAttribute("href", "/saisie")` compares
  // against a rendered DOM value — it's not a component writing the
  // path itself, which is the actual thing this scan guards against).
  const PRODUCTION_FILES = files.filter(
    (file) =>
      (file.endsWith(".tsx") || file.endsWith(".ts")) &&
      !file.endsWith(".test.tsx") &&
      !file.endsWith(".test.ts"),
  );

  it.each(PRODUCTION_FILES)(
    "%s never writes /saisie, /profil, /auth/sign-in, /graphes or /historique as a string literal",
    (file) => {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(LITERAL_ROUTE_PATTERN);
    },
  );
});
