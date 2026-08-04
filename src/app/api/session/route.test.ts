import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthMock, getSessionMock } = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  getSessionMock: vi.fn(),
}));
const { getSqlMock, getDbMock } = vi.hoisted(() => ({
  getSqlMock: vi.fn(),
  getDbMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuth: getAuthMock,
}));

// research Trap 6 + plan decision 6: getSession() falls back to a fetch
// against NEON_AUTH_BASE_URL, but never touches Postgres. Asserting the db
// module was never called is what proves the 401 path keeps that promise.
vi.mock("@/lib/db", () => ({
  getSql: getSqlMock,
  getDb: getDbMock,
}));

describe("GET /api/session", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getAuthMock.mockReset();
    getAuthMock.mockReturnValue({ getSession: getSessionMock });
    getSessionMock.mockReset();
    getSqlMock.mockReset();
    getDbMock.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns 401 when there is no session, without touching the database", async () => {
    getSessionMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(401);
    // Review finding 5: this is a non-regression guard, not proof — as of
    // this commit, route.ts does not import @/lib/db at all, so these two
    // assertions cannot fail no matter what the handler does. Their value
    // is for tomorrow: if someone adds a database read to this route, this
    // is what would catch it reaching Postgres on the 401 path.
    expect(getSqlMock).not.toHaveBeenCalled();
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("returns 503 when the auth server is unreachable — not 401", async () => {
    getSessionMock.mockResolvedValue({
      data: null,
      error: {
        message: "network error",
        status: 502,
        statusText: "Bad Gateway",
        code: "NETWORK_ERROR",
      },
    });
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(503);
    // Review s01, second pass, finding E: a 503 here is a silent infra
    // outage unless it's traced.
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  // Review s01, second pass, finding F: getSession()'s error carries the
  // upstream HTTP status verbatim. A 408 (request timeout) or 429 (rate
  // limited) is a transport/server-side failure — the auth server didn't
  // reject the token, it didn't even get to look at it — not a "no valid
  // session" case. isTransportOrServerFailure() previously only matched
  // status >= 500, so these rendered as 401, telling the client its
  // credentials were bad when the real problem was upstream.
  it.each([408, 429])(
    "returns 503, not 401, when the auth server responds %i",
    async (status) => {
      getSessionMock.mockResolvedValue({
        data: null,
        error: {
          message: "upstream failure",
          status,
          statusText: status === 408 ? "Request Timeout" : "Too Many Requests",
          code: status === 408 ? "REQUEST_TIMEOUT" : "RATE_LIMITED",
        },
      });
      const { GET } = await import("./route");

      const response = await GET();

      expect(response.status).toBe(503);
      expect(consoleErrorSpy).toHaveBeenCalled();
    },
  );

  // Review finding 2 (major): getSession() reports upstream 4xx responses
  // (expired or forged token) the same way it reports transport failures —
  // as { error }. Only the transport/5xx family should become 503; a 4xx
  // from the auth server is precisely the "no valid session" case
  // criterion 3 is about, and must stay 401.
  it("returns 401 when the auth server rejects an expired or forged token — not 503", async () => {
    getSessionMock.mockResolvedValue({
      data: null,
      error: {
        message: "invalid or expired session token",
        status: 401,
        statusText: "Unauthorized",
        code: "INVALID_SESSION_TOKEN",
      },
    });
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(401);
  });

  // Review finding 4 (minor): getAuth() throws synchronously when
  // NEON_AUTH_COOKIE_SECRET is missing or too short, and getSession()
  // re-throws fetch failures it doesn't classify as transport errors,
  // instead of returning { error }. With no try/catch, both produced an
  // uncontrolled 500 instead of the 503 that plan decision 6 promises for
  // an infra failure.
  it("returns 503 when getAuth() throws — e.g. a missing cookie secret — not a raw 500", async () => {
    getAuthMock.mockImplementation(() => {
      throw new Error("cookies.secret must be at least 32 characters");
    });
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(503);
    // Review s01, second pass, finding E: the global catch turns any
    // handler bug into a 503 — acceptable, but only if it's traced.
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("returns 503 when getSession() rejects with an unclassified error — not a raw 500", async () => {
    getSessionMock.mockRejectedValue(new Error("fetch failed"));
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(503);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("returns 200 with the identity read from the verified session, never a client-supplied id", async () => {
    getSessionMock.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "a@b.test" },
        session: { id: "session-1" },
      },
      error: null,
    });
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user).toEqual({ id: "user-1", email: "a@b.test" });
  });
});
