import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthMock, getSessionMock } = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuth: getAuthMock }));

// getDb() is called inside the handler, never at module scope (s01
// review, finding D) — same motif as every other route handler here.
const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: getDbMock }));

// R2: the route handler calls task 3/4's layer directly, never a second
// query builder of its own — mocked here exactly like src/app/api/
// profile/route.test.ts mocks src/lib/profile's saveHeight/
// saveTargetWeight, so this file tests routing/validation/taxonomy, not
// the DB layer already proven on PGlite in src/lib/db/sessions.test.ts.
const { getSessionForUserMock, updateSessionForUserMock, deleteSessionForUserMock } =
  vi.hoisted(() => ({
    getSessionForUserMock: vi.fn(),
    updateSessionForUserMock: vi.fn(),
    deleteSessionForUserMock: vi.fn(),
  }));
vi.mock("@/lib/db/sessions", () => ({
  getSessionForUser: getSessionForUserMock,
  updateSessionForUser: updateSessionForUserMock,
  deleteSessionForUser: deleteSessionForUserMock,
}));

const DB_STUB = { __stub: "db" };
const USER_B = { id: "user-b", email: "b@example.test" };
const SESSION_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

function jsonRequest(body: unknown, method: "PATCH" | "DELETE" = "PATCH"): Request {
  return new Request(`https://morpho.test/api/sessions/${SESSION_ID}`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "DELETE" ? undefined : JSON.stringify(body),
  });
}

function paramsFor(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

const EXISTING_SESSION = {
  id: SESSION_ID,
  measuredOn: "2026-08-01",
  createdAt: new Date("2026-08-01T10:00:00Z"),
  measurements: { weight_kg: 80 },
};

describe("PATCH /api/sessions/[id]", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getAuthMock.mockReset();
    getAuthMock.mockReturnValue({ getSession: getSessionMock });
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    getDbMock.mockReset();
    getDbMock.mockReturnValue(DB_STUB);
    getSessionForUserMock.mockReset();
    getSessionForUserMock.mockResolvedValue(EXISTING_SESSION);
    updateSessionForUserMock.mockReset();
    updateSessionForUserMock.mockResolvedValue({ found: true });
    deleteSessionForUserMock.mockReset();
    deleteSessionForUserMock.mockResolvedValue({ found: true });
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("exports dynamic = 'force-dynamic'", async () => {
    const routeModule = await import("./route");
    expect(routeModule.dynamic).toBe("force-dynamic");
  });

  it("returns 401 without a session, without touching the database at all", async () => {
    getSessionMock.mockResolvedValue({ data: null, error: null });
    const { PATCH } = await import("./route");

    const response = await PATCH(
      jsonRequest({ measuredOn: "2026-08-02", weight_kg: "80" }),
      paramsFor(SESSION_ID),
    );

    expect(response.status).toBe(401);
    expect(getDbMock).not.toHaveBeenCalled();
    expect(getSessionForUserMock).not.toHaveBeenCalled();
  });

  it("returns 503 when the auth server is unreachable — not 401", async () => {
    getSessionMock.mockResolvedValue({
      data: null,
      error: { message: "x", status: 502, statusText: "Bad Gateway", code: "NETWORK_ERROR" },
    });
    const { PATCH } = await import("./route");

    const response = await PATCH(
      jsonRequest({ measuredOn: "2026-08-02", weight_kg: "80" }),
      paramsFor(SESSION_ID),
    );

    expect(response.status).toBe(503);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("returns 404 on a malformed id, before touching the database", async () => {
    const { PATCH } = await import("./route");

    const response = await PATCH(
      jsonRequest({ measuredOn: "2026-08-02", weight_kg: "80" }),
      paramsFor("not-a-uuid"),
    );

    expect(response.status).toBe(404);
    expect(getDbMock).not.toHaveBeenCalled();
    expect(getSessionForUserMock).not.toHaveBeenCalled();
  });

  it("returns the SAME 404 for someone else's session as for a nonexistent one — never 'not yours'", async () => {
    getSessionForUserMock.mockResolvedValue(null);
    const { PATCH } = await import("./route");

    const response = await PATCH(
      jsonRequest({ measuredOn: "2026-08-02", weight_kg: "80" }),
      paramsFor(SESSION_ID),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(JSON.stringify(body).toLowerCase()).not.toContain("yours");
    expect(JSON.stringify(body).toLowerCase()).not.toContain("vôtre");
    expect(updateSessionForUserMock).not.toHaveBeenCalled();
  });

  it("returns 400 on an out-of-range value, without touching the write layer — other fields' errors are absent", async () => {
    const { PATCH } = await import("./route");

    const response = await PATCH(
      jsonRequest({ measuredOn: "2026-08-02", weight_kg: "5", waist_cm: "90" }),
      paramsFor(SESSION_ID),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.weight_kg).toBeDefined();
    expect(body.fieldErrors.waist_cm).toBeUndefined();
    expect(updateSessionForUserMock).not.toHaveBeenCalled();
  });

  it("returns 400 with R5's message when the payload is entirely empty", async () => {
    const { PATCH } = await import("./route");

    const response = await PATCH(
      jsonRequest({ measuredOn: "2026-08-02" }),
      paramsFor(SESSION_ID),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.formErrors).toEqual([
      "Une session doit contenir au moins une mesure. Pour tout retirer, supprimez la session.",
    ]);
    expect(updateSessionForUserMock).not.toHaveBeenCalled();
  });

  it("ignores a user_id smuggled in the payload — identity always comes from the session", async () => {
    const { PATCH } = await import("./route");

    await PATCH(
      jsonRequest({ measuredOn: "2026-08-02", weight_kg: "80", user_id: "user-a" }),
      paramsFor(SESSION_ID),
    );

    expect(updateSessionForUserMock).toHaveBeenCalledWith(
      DB_STUB,
      expect.objectContaining({ userId: USER_B.id }),
    );
  });

  it("calls updateSessionForUser with the desired state and returns 200 on success", async () => {
    const { PATCH } = await import("./route");

    const response = await PATCH(
      jsonRequest({ measuredOn: "2026-08-02", weight_kg: "81,5" }),
      paramsFor(SESSION_ID),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe(SESSION_ID);
    expect(updateSessionForUserMock).toHaveBeenCalledWith(DB_STUB, {
      sessionId: SESSION_ID,
      userId: USER_B.id,
      measuredOn: "2026-08-02",
      values: { weight_kg: 81.5 },
    });
  });

  it("returns 503 when the write fails", async () => {
    updateSessionForUserMock.mockRejectedValue(new Error("connection reset"));
    const { PATCH } = await import("./route");

    const response = await PATCH(
      jsonRequest({ measuredOn: "2026-08-02", weight_kg: "80" }),
      paramsFor(SESSION_ID),
    );

    expect(response.status).toBe(503);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("does not call revalidatePath — this route is the only write path (R2/R10)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(import.meta.dirname, "route.ts"), "utf8");
    expect(source).not.toContain("revalidatePath");
  });
});

describe("DELETE /api/sessions/[id]", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getAuthMock.mockReset();
    getAuthMock.mockReturnValue({ getSession: getSessionMock });
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    getDbMock.mockReset();
    getDbMock.mockReturnValue(DB_STUB);
    getSessionForUserMock.mockReset();
    getSessionForUserMock.mockResolvedValue(EXISTING_SESSION);
    deleteSessionForUserMock.mockReset();
    deleteSessionForUserMock.mockResolvedValue({ found: true });
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns 401 without a session, without touching the database", async () => {
    getSessionMock.mockResolvedValue({ data: null, error: null });
    const { DELETE } = await import("./route");

    const response = await DELETE(jsonRequest(undefined, "DELETE"), paramsFor(SESSION_ID));

    expect(response.status).toBe(401);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("returns 404 on a malformed id, without writing", async () => {
    const { DELETE } = await import("./route");

    const response = await DELETE(jsonRequest(undefined, "DELETE"), paramsFor("nope"));

    expect(response.status).toBe(404);
    expect(deleteSessionForUserMock).not.toHaveBeenCalled();
  });

  it("returns the same 404 for someone else's session as for a nonexistent one", async () => {
    getSessionForUserMock.mockResolvedValue(null);
    const { DELETE } = await import("./route");

    const response = await DELETE(jsonRequest(undefined, "DELETE"), paramsFor(SESSION_ID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(JSON.stringify(body).toLowerCase()).not.toContain("yours");
    expect(deleteSessionForUserMock).not.toHaveBeenCalled();
  });

  it("deletes with the session's own identity, never a client-supplied one, and returns 204", async () => {
    const { DELETE } = await import("./route");

    const response = await DELETE(jsonRequest(undefined, "DELETE"), paramsFor(SESSION_ID));

    expect(response.status).toBe(204);
    expect(deleteSessionForUserMock).toHaveBeenCalledWith(DB_STUB, {
      sessionId: SESSION_ID,
      userId: USER_B.id,
    });
  });

  it("returns 503 when the delete fails", async () => {
    deleteSessionForUserMock.mockRejectedValue(new Error("connection reset"));
    const { DELETE } = await import("./route");

    const response = await DELETE(jsonRequest(undefined, "DELETE"), paramsFor(SESSION_ID));

    expect(response.status).toBe(503);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("does not call revalidatePath", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(import.meta.dirname, "route.ts"), "utf8");
    expect(source).not.toContain("revalidatePath");
  });
});
