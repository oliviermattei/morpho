import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import dotenv from "dotenv";

// Next loads .env.local on its own; the Playwright process does not. Without
// this, E2E_EMAIL / E2E_PASSWORD would only ever be visible when exported by
// hand, and the authenticated project would silently never register.
dotenv.config({ path: path.join(__dirname, ".env.local"), quiet: true });

// `||`, not `??`: .env.local declares E2E_BASE_URL as an empty string, and
// dotenv loads that as "" rather than leaving it undefined — `??` would keep
// it and every navigation would fail with "Cannot navigate to invalid URL".
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

// ADR 019: session-dependent specs are named *.auth.spec.ts and run only in
// the `authenticated` project, which reuses the storageState opened by
// tests/e2e/auth.setup.ts. That setup signs in with a password — the whole
// point of dropping the magic link, which could never be automated without
// a mailbox and a human click.
//
// Both projects below are registered ONLY when credentials are present.
// Without them the suite is exactly what it was before, minus any
// half-configured project that would fail with a confusing redirect.
const E2E_CREDENTIALS_PRESENT = Boolean(
  process.env.E2E_EMAIL && process.env.E2E_PASSWORD,
);

const AUTH_SETUP_MATCH = /auth\.setup\.ts$/;
const AUTHENTICATED_MATCH = /.*\.auth\.spec\.ts$/;
const STORAGE_STATE = path.join(__dirname, "tests", "e2e", ".auth", "user.json");

const authenticatedProjects = E2E_CREDENTIALS_PRESENT
  ? [
      { name: "setup", testMatch: AUTH_SETUP_MATCH },
      {
        name: "authenticated",
        testMatch: AUTHENTICATED_MATCH,
        use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
        dependencies: ["setup"],
      },
    ]
  : [];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    // Mobile portrait is the primary target: several acceptance criteria are
    // expressed at 375px wide (no horizontal scroll, no overflow).
    // devices["iPhone 13"] is 390px wide — override the viewport to 375px
    // while keeping its webkit engine and touch emulation.
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], viewport: { width: 375, height: 812 } },
      testIgnore: [AUTH_SETUP_MATCH, AUTHENTICATED_MATCH],
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [AUTH_SETUP_MATCH, AUTHENTICATED_MATCH],
    },
    ...authenticatedProjects,
  ],
  // s10 plan task 9, decision 21: E2E_PROD switches the offline spec
  // (tests/e2e/pwa-offline.spec.ts) onto a REAL production build —
  // trap 13, `npm run dev` forces @serwist/turbopack's
  // disablePrecacheManifest and an empty additionalPrecacheEntries, so
  // an offline e2e played there would validate an illusion. reuseExistingServer
  // is FALSE whenever E2E_PROD is set, even outside CI: a dev machine's
  // own `npm run dev` almost always already occupies :3000, and without
  // this exclusion the production run would silently reuse it instead
  // of building and starting one — the exact illusion this variable
  // exists to avoid.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.E2E_PROD
          ? "npm run build && npm run start"
          : "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI && !process.env.E2E_PROD,
      },
});
