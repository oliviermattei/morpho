import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { getAuthMock } = vi.hoisted(() => ({ getAuthMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuth: getAuthMock }));

const { getBodyMapDataMock } = vi.hoisted(() => ({
  getBodyMapDataMock: vi.fn(),
}));
vi.mock("@/lib/db/body-map", () => ({ getBodyMapData: getBodyMapDataMock }));

// ADR 020: the page goes through requireOnboarded(), which reads the
// profile to decide whether the onboarding is done. The gate itself is
// deliberately NOT mocked — its redirects are part of what these tests
// assert — so its two dependencies are stubbed instead.
const { getProfileMock } = vi.hoisted(() => ({ getProfileMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/profile", () => ({ getProfile: getProfileMock }));

const ONBOARDED_PROFILE = {
  userId: "user-1",
  heightCm: 175,
  targetWeightKg: null,
  sex: "male" as const,
  transformationStartedOn: "2026-01-01",
};

// s10 plan task 7: AppHeader (mounted here for real) now always renders
// OfflineBanner, which calls useRouter() — needs a router context this
// jsdom render otherwise has none of, same mock as
// src/components/AppHeader.test.tsx already uses. redirect() must stay
// the REAL Next implementation — this page's own session guard throws
// it, and its `.digest` is exactly what the test above asserts on.
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    // ADR 020: BottomNav highlights the active destination from the
    // pathname. Outside a real router there is none, so it is pinned to
    // the home route — which is what this page's own tests exercise.
    usePathname: () => "/",
  };
});

beforeEach(() => {
  getProfileMock.mockReset();
  getProfileMock.mockResolvedValue(ONBOARDED_PROFILE);
});

const AUTHENTICATED_SESSION = {
  data: {
    user: { id: "user-1", email: "a@b.test" },
    session: { id: "session-1" },
  },
  error: null,
};

const EMPTY_BODY_MAP_DATA = { first: {}, last: {}, heightCm: null };

describe("(home)/page — session guard (decision 9, decision 17)", () => {
  it("redirects to /auth/sign-in when there is no session, without ever calling getBodyMapData — even mocked to reject", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    getBodyMapDataMock.mockRejectedValue(new Error("must never run"));
    const { default: Home } = await import("./page");

    let digest: string | undefined;
    try {
      await Home();
    } catch (thrown) {
      digest = (thrown as { digest?: string }).digest;
    }

    expect(digest).toMatch(/^NEXT_REDIRECT;.*\/auth\/sign-in/);
    expect(getBodyMapDataMock).not.toHaveBeenCalled();
  });

  it("exports dynamic = 'force-dynamic'", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const pageModule = await import("./page");

    expect(pageModule.dynamic).toBe("force-dynamic");
  });
});

// Decision 22: the reader receives exactly the session's id and nothing
// else — proven by spying on the call, not by re-reading a value that
// could have come from anywhere (a searchParams-fed id would produce
// the exact same call).
describe("(home)/page — identity provenance (decision 22)", () => {
  it("passes only the verified session's user id to getBodyMapData", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue(AUTHENTICATED_SESSION),
    });
    getBodyMapDataMock.mockResolvedValue(EMPTY_BODY_MAP_DATA);
    const { default: Home } = await import("./page");

    await Home();

    expect(getBodyMapDataMock).toHaveBeenCalledTimes(1);
    // The height rides along from the profile the gate already read
    // (ADR 020) — it is not a second identity, and the user id is still
    // the only thing that selects whose data is returned.
    expect(getBodyMapDataMock).toHaveBeenCalledWith("user-1", 175);
  });

  it("declares no searchParams prop", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "page.tsx"),
      "utf8",
    );

    expect(source).not.toContain("searchParams");
  });
});

describe("(home)/page — read failure (decision 15)", () => {
  it("shows the non-blocking error Empty, no technical code, and no half-rendered silhouette", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue(AUTHENTICATED_SESSION),
    });
    getBodyMapDataMock.mockRejectedValue(new Error("connection reset"));
    const { default: Home } = await import("./page");

    const element = await Home();
    render(element);

    expect(
      screen.getByText("Impossible de charger vos mesures"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Épaules")).toBeNull();
    expect(screen.queryByText(/Error|Exception|stack/i)).toBeNull();

    const retryLink = screen.getByRole("link", { name: /réessayer/i });
    expect(retryLink).toHaveAttribute("href", "/");
    expect(retryLink.className).toMatch(/\bh-11\b/);
  });

  // Criterion 8 (one tap to /saisie) must hold in EVERY state, including
  // this one. ADR 020 moved the control from the header to BottomNav's
  // central button, which is mounted outside the try/catch for the same
  // reason the header used to be: a read error must never take it down.
  it("still shows the capture button, at 44px+, even when the read fails", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue(AUTHENTICATED_SESSION),
    });
    getBodyMapDataMock.mockRejectedValue(new Error("connection reset"));
    const { default: Home } = await import("./page");

    const element = await Home();
    render(element);

    const saisirLink = screen.getByRole("link", { name: "Saisir une mesure" });
    expect(saisirLink).toHaveAttribute("href", "/saisie");
    // size-14 = 3.5rem = 56px, comfortably over the design system's
    // 44px §Cible tactile floor.
    expect(saisirLink.className).toMatch(/\bsize-14\b/);
  });
});

describe("(home)/page — design system compliance", () => {
  it("contains no literal color class, hex color, or arbitrary Tailwind value in a className", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "page.tsx"),
      "utf8",
    );
    const TAILWIND_PALETTE_COLOR_CLASS =
      /\b(?:bg|text|border|fill|stroke|from|via|to|ring|outline|decoration|caret|divide|placeholder)-(?:black|white|zinc|slate|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?\b/;
    const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/;
    const ARBITRARY_CLASSNAME_VALUE =
      /className=(?:{[^}]*)?["'][^"']*-\[[^\]]+\][^"']*["']/;

    expect(source).not.toMatch(TAILWIND_PALETTE_COLOR_CLASS);
    expect(source).not.toMatch(HEX_COLOR);
    expect(source).not.toMatch(ARBITRARY_CLASSNAME_VALUE);
  });
});

describe("(home)/page — initial state, no measurement session ever (criterion 9)", () => {
  it("renders the neutral silhouette AND the initial Empty — never a blank page, never a mute silhouette alone", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue(AUTHENTICATED_SESSION),
    });
    getBodyMapDataMock.mockResolvedValue(EMPTY_BODY_MAP_DATA);
    const { default: Home } = await import("./page");

    const element = await Home();
    render(element);

    // The silhouette IS rendered — the zone names are visible.
    expect(screen.getByText("Épaules")).toBeInTheDocument();
    expect(screen.getAllByText("Aucune mesure").length).toBeGreaterThan(0);

    // ...alongside the initial-state invitation, never instead of it.
    expect(screen.getByText("Aucune mesure enregistrée")).toBeInTheDocument();
    const ctaLink = screen.getByRole("link", {
      name: /saisir ma première mesure/i,
    });
    expect(ctaLink).toHaveAttribute("href", "/saisie");
    expect(ctaLink.className).toMatch(/\bh-11\b/);
  });
});

describe("(home)/page — nominal state", () => {
  it("renders the silhouette and the off-body cards, with no initial-state Empty", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue(AUTHENTICATED_SESSION),
    });
    getBodyMapDataMock.mockResolvedValue({
      first: { waist_cm: { measurementId: "m-first", value: 96 } },
      last: { waist_cm: { measurementId: "m-last", value: 88.6 } },
      heightCm: null,
    });
    const { default: Home } = await import("./page");

    const element = await Home();
    render(element);

    expect(screen.getByText("88,6 cm")).toBeInTheDocument();
    expect(screen.getAllByText("Poids").length).toBeGreaterThan(0);
    expect(screen.queryByText("Aucune mesure enregistrée")).toBeNull();
  });

  it("the capture button is a single 56px target to /saisie", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue(AUTHENTICATED_SESSION),
    });
    getBodyMapDataMock.mockResolvedValue(EMPTY_BODY_MAP_DATA);
    const { default: Home } = await import("./page");

    const element = await Home();
    render(element);

    const link = screen.getByRole("link", { name: "Saisir une mesure" });
    expect(link).toHaveAttribute("href", "/saisie");
    expect(link.className).toMatch(/\bsize-14\b/);
  });
});
