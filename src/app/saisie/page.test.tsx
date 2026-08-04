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

const ONBOARDED = {
  userId: "user-1",
  heightCm: 175,
  targetWeightKg: null,
  sex: "male" as const,
  transformationStartedOn: "2026-01-01",
};


// Same motif as src/app/page.test.tsx: redirect() stays the real
// implementation (it genuinely throws NEXT_REDIRECT), only useRouter is
// stubbed — MeasurementSessionForm calls it at render time and would
// otherwise throw outside a real Next router context.
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, useRouter: () => ({ push: vi.fn() }) };
});

// Plan task 3's note of method (SessionHistory/HistoriquePage precedent):
// a Server Component wrapped in <Suspense> is never resolved by Testing
// Library's render() — React doesn't await an async child on the client.
// Stubbing MeasurementSessionFormLoader synchronously is what makes this
// page renderable in a test at all, not just what the isolation
// assertion below needs.
const { measurementSessionFormLoaderMock } = vi.hoisted(() => ({
  // The parameter exists only so vi.fn()'s inferred type keeps
  // .mock.calls[0][0] as { userId: string }, not never.
  measurementSessionFormLoaderMock: vi.fn((props: { userId: string }) => {
    void props;
    return <div data-testid="measurement-session-form-loader-stub" />;
  }),
}));
vi.mock("@/components/MeasurementSessionFormLoader", () => ({
  MeasurementSessionFormLoader: measurementSessionFormLoaderMock,
}));

beforeEach(() => {
  getProfileMock.mockReset();
  getProfileMock.mockResolvedValue(ONBOARDED);
});

describe("SaisiePage", () => {
  it("redirects to /auth/sign-in when there is no session", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const { default: SaisiePage } = await import("./page");

    let digest: string | undefined;
    try {
      await SaisiePage();
    } catch (thrown) {
      digest = (thrown as { digest?: string }).digest;
    }

    expect(digest).toMatch(/^NEXT_REDIRECT;.*\/auth\/sign-in/);
  });

  it("renders the h1 and the shared header, without waiting on the database", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({
        data: {
          user: { id: "user-1", email: "a@b.test" },
          session: { id: "session-1" },
        },
        error: null,
      }),
    });
    const { default: SaisiePage } = await import("./page");

    const element = await SaisiePage();
    render(element);

    expect(
      screen.getByRole("heading", { name: "Nouvelle session" }),
    ).toBeInTheDocument();

    // The "‹ Retour" link is gone: BottomNav is mounted on every screen,
    // so a second way to leave the page only competed with the bar.
    expect(screen.queryByRole("link", { name: "‹ Retour" })).toBeNull();
    expect(screen.getByText("Saisie")).toBeInTheDocument();
  });

  // Plan task 3: the page level of the loader wiring — passes only the
  // verified session's userId, wrapped in Suspense with the skeleton as
  // fallback.
  it("passes only the userId from the verified session to MeasurementSessionFormLoader, wrapped in Suspense", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({
        data: {
          user: { id: "user-1", email: "a@b.test" },
          session: { id: "session-1" },
        },
        error: null,
      }),
    });
    const { default: SaisiePage } = await import("./page");

    const element = await SaisiePage();
    render(element);

    expect(measurementSessionFormLoaderMock.mock.calls[0]?.[0]).toEqual({
      userId: "user-1",
    });
    expect(
      screen.getByTestId("measurement-session-form-loader-stub"),
    ).toBeInTheDocument();
  });

  it("exports dynamic = 'force-dynamic' — non-negotiable per plan decision 20", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const pageModule = await import("./page");

    expect(pageModule.dynamic).toBe("force-dynamic");
  });
});
