import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { getAuthMock } = vi.hoisted(() => ({ getAuthMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuth: getAuthMock }));

// The real redirect() (used by the session guard, below) throws a
// NEXT_REDIRECT digest without needing a mounted app router — it is
// deliberately NOT mocked, same as src/app/profil/page.test.tsx and
// src/app/(home)/page.test.tsx. useRouter() is different: RetryButton
// (rendered by the read-error state) calls it directly and requires an
// app-router context this jsdom render never has, so only that export
// is overridden.
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    useRouter: () => ({ refresh: vi.fn() }),
    // ADR 020: GraphesShell mounts BottomNav, which reads the pathname.
    usePathname: () => "/graphes",
  };
});

// ADR 020: /graphes redirects to the onboarding when the profile is
// incomplete, so every test that expects the page to actually RENDER has
// to hand back a complete one. The two read-error tests deliberately
// keep a null/rejected profile: the error state is returned before the
// onboarding check is ever reached, which is the point.
const ONBOARDED_NO_TARGET = {
  userId: "user-1",
  heightCm: 175,
  targetWeightKg: null,
  sex: "male" as const,
  transformationStartedOn: "2026-01-01",
};

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn(() => "fake-db") }));
vi.mock("@/lib/db", () => ({ getDb: getDbMock }));

const { getAllMeasurementSeriesMock } = vi.hoisted(() => ({
  getAllMeasurementSeriesMock: vi.fn(),
}));
vi.mock("@/lib/db/measurement-series", () => ({
  getAllMeasurementSeries: getAllMeasurementSeriesMock,
}));

// s08 task 7: the target weight is read off the same profile row s04
// already reads (getProfile), alongside the series — no new module.
const { getProfileMock } = vi.hoisted(() => ({ getProfileMock: vi.fn() }));
vi.mock("@/lib/profile", () => ({ getProfile: getProfileMock }));

const AUTHENTICATED_SESSION = {
  data: { user: { id: "user-1", email: "a@b.test" }, session: { id: "s1" } },
  error: null,
};

const EMPTY_SERIES = {
  byKind: {
    weight_kg: [],
    shoulders_cm: [],
    chest_cm: [],
    biceps_cm: [],
    waist_cm: [],
    hips_cm: [],
    thigh_cm: [],
    calf_cm: [],
    body_fat_pct: [],
    muscle_pct: [],
  },
  bmi: { status: "heightMissing" },
};

describe("GraphesPage — session guard (P14)", () => {
  it("redirects to /auth/sign-in when there is no session", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const { default: GraphesPage } = await import("./page");

    let digest: string | undefined;
    try {
      await GraphesPage();
    } catch (thrown) {
      digest = (thrown as { digest?: string }).digest;
    }

    expect(digest).toMatch(/^NEXT_REDIRECT;.*\/auth\/sign-in/);
  });

  // The test that distinguishes the two failure modes: a transport/server
  // error from the auth server must show the read-error state, never
  // redirect — redirecting here would send a connected user through a
  // sign-in flow that fails for the exact same reason.
  it("a transport/server error from getSession() shows the read-error state, NOT a redirect to sign-in", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({
        data: null,
        error: { status: 503, code: "INTERNAL_ERROR" },
      }),
    });
    const { default: GraphesPage } = await import("./page");

    const element = await GraphesPage();
    render(element);

    expect(
      screen.getByText("Impossible de charger la courbe"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("getAuth() throwing synchronously shows the read-error state", async () => {
    getAuthMock.mockImplementation(() => {
      throw new Error("cookies.secret missing");
    });
    const { default: GraphesPage } = await import("./page");

    const element = await GraphesPage();
    render(element);

    expect(
      screen.getByText("Impossible de charger la courbe"),
    ).toBeInTheDocument();
  });

  it("a non-transport auth error (expired/forged token) redirects to sign-in, not the error state", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({
        data: null,
        error: { status: 401, code: "UNAUTHORIZED" },
      }),
    });
    const { default: GraphesPage } = await import("./page");

    let digest: string | undefined;
    try {
      await GraphesPage();
    } catch (thrown) {
      digest = (thrown as { digest?: string }).digest;
    }

    expect(digest).toMatch(/^NEXT_REDIRECT;.*\/auth\/sign-in/);
  });

  it("exports dynamic = 'force-dynamic'", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const pageModule = await import("./page");

    expect(pageModule.dynamic).toBe("force-dynamic");
  });
});

describe("GraphesPage — data path", () => {
  it("with a session, passes the series read for that user's id to the panel", async () => {
    getAuthMock.mockReturnValue({ getSession: vi.fn().mockResolvedValue(AUTHENTICATED_SESSION) });
    getAllMeasurementSeriesMock.mockResolvedValue(EMPTY_SERIES);
    getProfileMock.mockResolvedValue(ONBOARDED_NO_TARGET);
    const { default: GraphesPage } = await import("./page");

    await GraphesPage();

    expect(getAllMeasurementSeriesMock).toHaveBeenCalledWith("fake-db", "user-1");
  });

  it("a failure reading the series shows the read-error state, never an unhandled exception", async () => {
    getAuthMock.mockReturnValue({ getSession: vi.fn().mockResolvedValue(AUTHENTICATED_SESSION) });
    getAllMeasurementSeriesMock.mockRejectedValue(new Error("connection reset"));
    getProfileMock.mockResolvedValue(ONBOARDED_NO_TARGET);
    const { default: GraphesPage } = await import("./page");

    const element = await GraphesPage();
    render(element);

    expect(
      screen.getByText("Impossible de charger la courbe"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Error|Exception|connection reset/i)).toBeNull();
  });

  // s08 task 7: a failure reading the PROFILE (the target weight's own
  // source) is just as much a data-layer failure as the series read —
  // the whole page shows the same read-error state, not a half-rendered
  // chart with a silently missing target.
  it("a failure reading the profile also shows the read-error state", async () => {
    getAuthMock.mockReturnValue({ getSession: vi.fn().mockResolvedValue(AUTHENTICATED_SESSION) });
    getAllMeasurementSeriesMock.mockResolvedValue(EMPTY_SERIES);
    getProfileMock.mockRejectedValue(new Error("connection reset"));
    const { default: GraphesPage } = await import("./page");

    const element = await GraphesPage();
    render(element);

    expect(
      screen.getByText("Impossible de charger la courbe"),
    ).toBeInTheDocument();
  });

  it("renders the back link and the title alongside the panel", async () => {
    getAuthMock.mockReturnValue({ getSession: vi.fn().mockResolvedValue(AUTHENTICATED_SESSION) });
    getAllMeasurementSeriesMock.mockResolvedValue(EMPTY_SERIES);
    getProfileMock.mockResolvedValue(ONBOARDED_NO_TARGET);
    const { default: GraphesPage } = await import("./page");

    const element = await GraphesPage();
    render(element);

    expect(screen.getByRole("heading", { name: "Évolution" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "‹ Accueil" })).toHaveAttribute("href", "/");
  });
});

describe("GraphesPage — target weight passthrough (s08 task 7)", () => {
  it("reads the target weight for the session's own user id, off the same profile row", async () => {
    getAuthMock.mockReturnValue({ getSession: vi.fn().mockResolvedValue(AUTHENTICATED_SESSION) });
    getAllMeasurementSeriesMock.mockResolvedValue({
      byKind: { ...EMPTY_SERIES.byKind, weight_kg: [{ t: Date.UTC(2026, 2, 30), value: 74.1 }] },
      bmi: EMPTY_SERIES.bmi,
    });
    getProfileMock.mockResolvedValue({
      ...ONBOARDED_NO_TARGET,
      targetWeightKg: 72,
    });
    const { default: GraphesPage } = await import("./page");

    const element = await GraphesPage();
    render(element);

    expect(getProfileMock).toHaveBeenCalledWith("fake-db", "user-1");
    expect(screen.getByText(/écart \+2,1 kg/)).toBeInTheDocument();
  });

  it("passes null when the profile has no target yet — no row, no line", async () => {
    getAuthMock.mockReturnValue({ getSession: vi.fn().mockResolvedValue(AUTHENTICATED_SESSION) });
    getAllMeasurementSeriesMock.mockResolvedValue({
      byKind: { ...EMPTY_SERIES.byKind, weight_kg: [{ t: Date.UTC(2026, 2, 30), value: 74.1 }] },
      bmi: EMPTY_SERIES.bmi,
    });
    getProfileMock.mockResolvedValue(ONBOARDED_NO_TARGET);
    const { default: GraphesPage } = await import("./page");

    const element = await GraphesPage();
    render(element);

    expect(screen.queryByText(/écart/)).toBeNull();
  });
});

// Test of forgery (task 7): nothing client-controlled — no searchParams,
// no header, no parameter — can influence which user's data is read.
describe("GraphesPage — identity provenance (forgery test)", () => {
  it("declares no searchParams prop, and reads the id only from the verified session", async () => {
    const source = readFileSync(resolve(import.meta.dirname, "page.tsx"), "utf8");
    expect(source).not.toContain("searchParams");

    getAuthMock.mockReturnValue({ getSession: vi.fn().mockResolvedValue(AUTHENTICATED_SESSION) });
    getAllMeasurementSeriesMock.mockClear();
    getAllMeasurementSeriesMock.mockResolvedValue(EMPTY_SERIES);
    const { default: GraphesPage } = await import("./page");

    await GraphesPage();

    // Exactly one read, with the verified session's id — never a second
    // call, and never anything but that id (a searchParams-fed id would
    // produce this exact same call, which is why the source-level check
    // above matters too).
    expect(getAllMeasurementSeriesMock).toHaveBeenCalledTimes(1);
    expect(getAllMeasurementSeriesMock).toHaveBeenCalledWith("fake-db", "user-1");
  });
});

describe("graphes/loading.tsx", () => {
  it("exists and renders Skeleton placeholders, not the (home) silhouette skeleton", async () => {
    const { default: GraphesLoading } = await import("./loading");

    const { container } = render(<GraphesLoading />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Évolution" })).toBeInTheDocument();
    expect(screen.queryByText("Épaules")).toBeNull();
  });

  // s08 task 8 (d): the target gap row must be part of the skeleton too,
  // or the card visibly re-lays-out under the user's fingers the instant
  // real data (with a target set) arrives — one more placeholder than
  // s07 shipped (value block, chart area, legend).
  it("includes a placeholder for the target gap row, inside the card, before the chart area", async () => {
    const { default: GraphesLoading } = await import("./loading");

    const { container } = render(<GraphesLoading />);

    const card = container.querySelector('[data-slot="card-content"]');
    expect(card).not.toBeNull();
    const skeletonsInCard = Array.from(
      card!.querySelectorAll('[data-slot="skeleton"]'),
    );
    // value block (3) + gap row (1) + chart (1) + legend (1) = 6
    expect(skeletonsInCard.length).toBe(6);
  });
});
