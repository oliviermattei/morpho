// @vitest-environment node
//
// Plan s06 decision 8: three paths declared once, so no component in the
// s06 scope writes a route as a string literal. This test is what makes
// criterion 8 (one tap to /saisie) falsifiable outside a browser: it
// proves each constant actually resolves to a page that exists on disk,
// not just that the constant has some string value.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { routes } from "./routes";

const APP_DIR = resolve(import.meta.dirname, "..", "app");

// Maps a route path to the App Router page.tsx it must resolve to.
const ROUTE_TO_PAGE_FILE: Record<string, string> = {
  [routes.entry]: resolve(APP_DIR, "saisie", "page.tsx"),
  [routes.profile]: resolve(APP_DIR, "profil", "page.tsx"),
  [routes.signIn]: resolve(APP_DIR, "auth", "sign-in", "page.tsx"),
  [routes.charts]: resolve(APP_DIR, "graphes", "page.tsx"),
  [routes.history]: resolve(APP_DIR, "historique", "page.tsx"),
  [routes.onboarding]: resolve(APP_DIR, "onboarding", "page.tsx"),
};

describe("routes", () => {
  it("declares exactly entry, profile, signIn, charts, history, onboarding and sessionEdit", () => {
    // s09 R1: sessionEdit is a function, not a string — treated apart from
    // the string constants below rather than folded into toEqual, which
    // would compare function identity meaninglessly.
    const { sessionEdit, ...stringRoutes } = routes;
    expect(stringRoutes).toEqual({
      entry: "/saisie",
      profile: "/profil",
      signIn: "/auth/sign-in",
      charts: "/graphes",
      history: "/historique",
      onboarding: "/onboarding",
    });
    expect(typeof sessionEdit).toBe("function");
  });

  it("sessionEdit builds /historique/<id> from a session id", () => {
    expect(routes.sessionEdit("abc-123")).toBe("/historique/abc-123");
  });

  it.each(Object.entries(ROUTE_TO_PAGE_FILE))(
    "%s resolves to a page.tsx that actually exists on disk",
    (_route, pageFile) => {
      expect(existsSync(pageFile)).toBe(true);
    },
  );
});
