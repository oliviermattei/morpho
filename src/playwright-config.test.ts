// @vitest-environment node
//
// Importing @playwright/test through Vite under the default jsdom
// environment is pathological: it drags in playwright-core (13MB) and takes
// over two minutes. Under node it's near-instant. This file never touches
// the DOM, so node is also the correct environment, not just the fast one.
import { afterEach, describe, expect, it, vi } from "vitest";
import config from "../playwright.config";

// s01 plan decision 7: devices["iPhone 13"] is 390px wide, but s06/s07 acceptance
// criteria are written against a 375px viewport. Without this override the
// "mobile" project would silently test the wrong width.
describe("playwright.config mobile project", () => {
  it("forces a 375x812 viewport while keeping iPhone 13's webkit + touch", () => {
    const mobile = config.projects?.find((project) => project.name === "mobile");

    expect(mobile).toBeDefined();
    expect(mobile?.use?.viewport).toEqual({ width: 375, height: 812 });
    expect(mobile?.use?.hasTouch).toBe(true);
    expect(mobile?.use?.defaultBrowserType).toBe("webkit");
  });

  it("keeps a desktop project", () => {
    const desktop = config.projects?.find((project) => project.name === "desktop");

    expect(desktop).toBeDefined();
  });
});

// s10 plan task 9, decision 21: the config reads process.env at module
// evaluation time — vi.resetModules() + a fresh dynamic import is what
// lets each test pin its own env combination without leaking into the
// next one.
describe("playwright.config webServer — E2E_PROD (s10 task 9)", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  async function loadConfig() {
    vi.resetModules();
    const mod = await import("../playwright.config");
    return mod.default;
  }

  it("runs `npm run dev` when E2E_PROD is unset", async () => {
    delete process.env.E2E_PROD;
    delete process.env.E2E_BASE_URL;
    const freshConfig = await loadConfig();

    expect(freshConfig.webServer).toMatchObject({ command: "npm run dev" });
  });

  // Trap 13: under `npm run dev`, @serwist/turbopack forces
  // disablePrecacheManifest and an empty additionalPrecacheEntries — an
  // offline e2e played there would validate an illusion.
  it("runs `npm run build && npm run start` when E2E_PROD is set", async () => {
    process.env.E2E_PROD = "1";
    delete process.env.E2E_BASE_URL;
    const freshConfig = await loadConfig();

    expect(freshConfig.webServer).toMatchObject({
      command: "npm run build && npm run start",
    });
  });

  it("reuses an existing server outside CI and outside E2E_PROD", async () => {
    delete process.env.CI;
    delete process.env.E2E_PROD;
    delete process.env.E2E_BASE_URL;
    const freshConfig = await loadConfig();

    expect(
      (freshConfig.webServer as { reuseExistingServer?: boolean })
        ?.reuseExistingServer,
    ).toBe(true);
  });

  // The named trap (decision 21): on a dev machine, `npm run dev`
  // almost always already occupies :3000 — without this exclusion,
  // `E2E_PROD=1 npm run test:e2e:pwa` would silently REUSE that dev
  // server instead of building and starting a production one, and the
  // spec would pass having validated trap 13's exact illusion.
  it("never reuses an existing server when E2E_PROD is set, even outside CI", async () => {
    delete process.env.CI;
    process.env.E2E_PROD = "1";
    delete process.env.E2E_BASE_URL;
    const freshConfig = await loadConfig();

    expect(
      (freshConfig.webServer as { reuseExistingServer?: boolean })
        ?.reuseExistingServer,
    ).toBe(false);
  });
});
