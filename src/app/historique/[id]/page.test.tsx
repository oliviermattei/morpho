import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { getAuthMock } = vi.hoisted(() => ({ getAuthMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuth: getAuthMock }));

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: getDbMock }));

const { getSessionForUserMock } = vi.hoisted(() => ({
  getSessionForUserMock: vi.fn(),
}));
vi.mock("@/lib/db/sessions", () => ({
  getSessionForUser: getSessionForUserMock,
}));

// Only useRouter is stubbed — MeasurementSessionForm and
// DeleteSessionDialog (both rendered for real below) call it, but
// redirect()/notFound() must stay the REAL Next implementations: their
// thrown `.digest` is exactly what these tests assert on.
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  };
});

const DB_STUB = { __stub: "db" };
const USER_A = { id: "user-a", email: "a@example.test" };
const VALID_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

function paramsFor(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function authed(user: { id: string; email: string } | null) {
  getAuthMock.mockReturnValue({
    getSession: vi
      .fn()
      .mockResolvedValue(
        user
          ? { data: { user, session: { id: "session-x" } }, error: null }
          : { data: null, error: null },
      ),
  });
}

describe("/historique/[id] page", () => {
  it("exports dynamic = 'force-dynamic'", async () => {
    const pageModule = await import("./page");
    expect(pageModule.dynamic).toBe("force-dynamic");
  });

  it("redirects to /auth/sign-in when there is no session — before touching the database", async () => {
    authed(null);
    getDbMock.mockReturnValue(DB_STUB);
    const { default: SessionEditPage } = await import("./page");

    let digest: string | undefined;
    try {
      await SessionEditPage(paramsFor(VALID_ID));
    } catch (thrown) {
      digest = (thrown as { digest?: string }).digest;
    }

    expect(digest).toMatch(/^NEXT_REDIRECT;.*\/auth\/sign-in/);
    expect(getDbMock).not.toHaveBeenCalled();
    expect(getSessionForUserMock).not.toHaveBeenCalled();
  });

  it("calls notFound() on a malformed id — without touching the database", async () => {
    authed(USER_A);
    getDbMock.mockReturnValue(DB_STUB);
    const { default: SessionEditPage } = await import("./page");

    let digest: string | undefined;
    try {
      await SessionEditPage(paramsFor("not-a-uuid"));
    } catch (thrown) {
      digest = (thrown as { digest?: string }).digest;
    }

    expect(digest).toMatch(/^NEXT_HTTP_ERROR_FALLBACK;404/);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("calls notFound() when the session doesn't exist or belongs to someone else", async () => {
    authed(USER_A);
    getDbMock.mockReturnValue(DB_STUB);
    getSessionForUserMock.mockResolvedValue(null);
    const { default: SessionEditPage } = await import("./page");

    let digest: string | undefined;
    try {
      await SessionEditPage(paramsFor(VALID_ID));
    } catch (thrown) {
      digest = (thrown as { digest?: string }).digest;
    }

    expect(digest).toMatch(/^NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("renders the form pre-filled with the recorded values, with the date only in the picker", async () => {
    authed(USER_A);
    getDbMock.mockReturnValue(DB_STUB);
    getSessionForUserMock.mockResolvedValue({
      id: VALID_ID,
      measuredOn: "2026-08-01",
      createdAt: new Date("2026-08-01T10:00:00Z"),
      measurements: { weight_kg: 82.4 },
    });
    const { default: SessionEditPage } = await import("./page");

    const element = await SessionEditPage(paramsFor(VALID_ID));
    render(element);

    expect(screen.queryByRole("link", { name: "‹ Historique" })).toBeNull();

    expect(
      (screen.getByLabelText("Poids (kg)") as HTMLInputElement).value,
    ).toBe("82,4");
    // The date is shown ONCE, by the picker itself — the read-only line
    // that used to repeat it under the title is gone.
    expect(screen.getByLabelText("Date")).toHaveTextContent("1 août 2026");
    expect(screen.getAllByText(/1 août 2026/)).toHaveLength(1);
  });

  it("reads the session for the segment id and the verified user's own id, never a client-controlled one", async () => {
    authed(USER_A);
    getDbMock.mockReturnValue(DB_STUB);
    getSessionForUserMock.mockResolvedValue({
      id: VALID_ID,
      measuredOn: "2026-08-01",
      createdAt: new Date("2026-08-01T10:00:00Z"),
      measurements: {},
    });
    const { default: SessionEditPage } = await import("./page");

    await SessionEditPage(paramsFor(VALID_ID));

    expect(getSessionForUserMock).toHaveBeenCalledWith(DB_STUB, {
      sessionId: VALID_ID,
      userId: USER_A.id,
    });
  });

  it("renders the danger zone with the delete dialog trigger, after a FieldSeparator", async () => {
    authed(USER_A);
    getDbMock.mockReturnValue(DB_STUB);
    getSessionForUserMock.mockResolvedValue({
      id: VALID_ID,
      measuredOn: "2026-08-01",
      createdAt: new Date("2026-08-01T10:00:00Z"),
      measurements: { weight_kg: 82.4, waist_cm: 90 },
    });
    const { default: SessionEditPage } = await import("./page");

    const { container } = render(await SessionEditPage(paramsFor(VALID_ID)));

    expect(
      container.querySelectorAll('[data-slot="field-separator"]').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Supprimer la session" }),
    ).toBeInTheDocument();
  });
});
