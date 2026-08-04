import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { getAuthMock } = vi.hoisted(() => ({ getAuthMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuth: getAuthMock }));

// ADR 020: the page now goes through requireOnboarded(), which reads the
// profile to decide whether the onboarding is done. The gate itself is
// deliberately NOT mocked — its redirects are part of what these tests
// assert — so its two dependencies are stubbed instead.
const { getProfileMock } = vi.hoisted(() => ({ getProfileMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/profile", () => ({ getProfile: getProfileMock }));

// The page now mounts PageHeader, which renders OfflineBanner —
// useRouter() needs a router context this jsdom render otherwise has
// none of. Same mock as src/app/(home)/page.test.tsx already uses;
// redirect() must stay the REAL Next implementation, since the gate's
// own redirects are what several tests below assert on.
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/historique",
  };
});

const ONBOARDED = {
  userId: "user-1",
  heightCm: 175,
  targetWeightKg: null,
  sex: "male" as const,
  transformationStartedOn: "2026-01-01",
};


// Plan task 8's note of method: a Server Component wrapped in <Suspense>
// is never resolved by Testing Library's render() — React doesn't await
// an async child on the client. Stubbing SessionHistory synchronously is
// what makes this page renderable in a test at all, not just what task
// 8's isolation assertion needs.
const { sessionHistoryMock } = vi.hoisted(() => ({
  // The parameter exists only so vi.fn()'s inferred type keeps
  // .mock.calls[0][0] as { userId: string }, not never.
  sessionHistoryMock: vi.fn((props: { userId: string }) => {
    void props;
    return <div data-testid="session-history-stub" />;
  }),
}));
vi.mock("@/components/SessionHistory", () => ({
  SessionHistory: sessionHistoryMock,
}));

beforeEach(() => {
  getProfileMock.mockReset();
  getProfileMock.mockResolvedValue(ONBOARDED);
});

describe("HistoriquePage", () => {
  it("redirects to /auth/sign-in when there is no session", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const { default: HistoriquePage } = await import("./page");

    let digest: string | undefined;
    try {
      await HistoriquePage();
    } catch (thrown) {
      digest = (thrown as { digest?: string }).digest;
    }

    expect(digest).toMatch(/^NEXT_REDIRECT;.*\/auth\/sign-in/);
  });

  it("renders the h1, the shared header and the Nouvelle session button — without waiting on the database", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({
        data: {
          user: { id: "user-1", email: "a@b.test" },
          session: { id: "session-1" },
        },
        error: null,
      }),
    });
    const { default: HistoriquePage } = await import("./page");

    const element = await HistoriquePage();
    render(element);

    expect(
      screen.getByRole("heading", { name: "Historique" }),
    ).toBeInTheDocument();

    expect(screen.queryByRole("link", { name: "‹ Retour" })).toBeNull();

    const newSessionLink = screen.getByRole("link", {
      name: "Nouvelle session",
    });
    expect(newSessionLink).toHaveAttribute("href", "/saisie");
    expect(newSessionLink.className).toMatch(/\bh-11\b/);
  });

  // The page level of plan task 8's three-level isolation proof
  // (criterion 7): SessionHistory must receive exactly { userId } from
  // the verified session — the toEqual below fails if any other prop
  // ever gets forwarded to it.
  it("passes only the userId from the verified session to SessionHistory, wrapped in Suspense", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({
        data: {
          user: { id: "user-1", email: "a@b.test" },
          session: { id: "session-1" },
        },
        error: null,
      }),
    });
    const { default: HistoriquePage } = await import("./page");

    const element = await HistoriquePage();
    render(element);

    expect(sessionHistoryMock.mock.calls[0]?.[0]).toEqual({
      userId: "user-1",
    });
    expect(screen.getByTestId("session-history-stub")).toBeInTheDocument();
  });

  it("exports dynamic = 'force-dynamic' — every page calling getAuth() must (plan decision 20)", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const pageModule = await import("./page");

    expect(pageModule.dynamic).toBe("force-dynamic");
  });
});
