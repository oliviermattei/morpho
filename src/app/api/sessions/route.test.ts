import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { measurements, measurementSessions } from "@/lib/db/schema";

const { getAuthMock, getSessionMock } = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuth: getAuthMock }));

// Plan decision 10: the write path is db.batch([...]) — never
// db.transaction(), which the neon-http driver throws on. getDb() is
// called inside the handler, not at module scope (s01 review, finding D).
const { getDbMock, batchMock, insertMock, valuesMock } = vi.hoisted(() => {
  const valuesMock = vi.fn((value: unknown) => ({ __values: value }));
  const insertMock = vi.fn((table: unknown) => ({
    values: valuesMock,
    __table: table,
  }));
  // The parameter exists only so vi.fn()'s inferred type keeps
  // .mock.calls[0][0] as unknown[] below, not never[].
  const batchMock = vi.fn(async (queries: unknown[]) => {
    void queries;
    return [];
  });
  const getDbMock = vi.fn(() => ({ insert: insertMock, batch: batchMock }));
  return { getDbMock, batchMock, insertMock, valuesMock };
});

vi.mock("@/lib/db", () => ({ getDb: getDbMock }));

function jsonRequest(body: unknown): Request {
  return new Request("https://morpho.test/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const USER_B = { id: "user-b", email: "b@example.test" };

describe("POST /api/sessions", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getAuthMock.mockReset();
    getAuthMock.mockReturnValue({ getSession: getSessionMock });
    getSessionMock.mockReset();
    getDbMock.mockClear();
    batchMock.mockClear();
    batchMock.mockResolvedValue([]);
    insertMock.mockClear();
    valuesMock.mockClear();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns 401 without a session, without touching the database", async () => {
    getSessionMock.mockResolvedValue({ data: null, error: null });
    const { POST } = await import("./route");

    const response = await POST(jsonRequest({ measuredOn: "2026-08-02" }));

    expect(response.status).toBe(401);
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
    const { POST } = await import("./route");

    const response = await POST(jsonRequest({ measuredOn: "2026-08-02" }));

    expect(response.status).toBe(503);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("returns 400 on an entirely empty form, and never touches the database — the persisted half of criterion 4", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    const { POST } = await import("./route");

    const response = await POST(jsonRequest({ measuredOn: "2026-08-02" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.formErrors).toEqual([
      "Renseignez au moins une mesure avant d'enregistrer.",
    ]);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("returns 400 on an out-of-range value, without touching the database", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    const { POST } = await import("./route");

    const response = await POST(
      jsonRequest({ measuredOn: "2026-08-02", waist_cm: "500" }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.waist_cm).toBeDefined();
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("returns 201 on weight alone, persisting exactly one measurements row through db.batch", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    const { POST } = await import("./route");

    const response = await POST(
      jsonRequest({ measuredOn: "2026-08-02", weight_kg: "82,4" }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toEqual(expect.any(String));

    expect(batchMock).toHaveBeenCalledTimes(1);
    const batchedQueries = batchMock.mock.calls[0]?.[0] as unknown[];
    expect(batchedQueries).toHaveLength(2);

    expect(insertMock).toHaveBeenNthCalledWith(1, measurementSessions);
    expect(valuesMock).toHaveBeenNthCalledWith(1, {
      id: body.id,
      userId: USER_B.id,
      measuredOn: "2026-08-02",
    });

    expect(insertMock).toHaveBeenNthCalledWith(2, measurements);
    const measurementRows = valuesMock.mock.calls[1]?.[0] as {
      kind: string;
      value: number;
      sessionId: string;
    }[];
    expect(measurementRows).toHaveLength(1);
    expect(measurementRows[0]).toMatchObject({
      kind: "weight_kg",
      value: 82.4,
      sessionId: body.id,
    });
  });

  it("ignores a user_id forged in the payload — the session created belongs to the authenticated user, never the client-supplied id", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    const { POST } = await import("./route");

    await POST(
      jsonRequest({
        measuredOn: "2026-08-02",
        weight_kg: "80",
        user_id: "user-a",
      }),
    );

    expect(valuesMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userId: USER_B.id }),
    );
  });

  // Plan task 8, criterion 7 — the handler level of the three: no client
  // parameter, wherever it's carried (query string, body, header),
  // influences the identity the route persists under. Body forgery is the
  // test just above; these two cover the other surfaces named explicitly
  // in the plan.
  it("ignores a user_id forged into the query string", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    const { POST } = await import("./route");

    const request = new Request(
      "https://morpho.test/api/sessions?user_id=user-a",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ measuredOn: "2026-08-02", weight_kg: "80" }),
      },
    );
    await POST(request);

    expect(valuesMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userId: USER_B.id }),
    );
  });

  it("ignores a user_id forged into a request header", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    const { POST } = await import("./route");

    const request = new Request("https://morpho.test/api/sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "user-a",
      },
      body: JSON.stringify({ measuredOn: "2026-08-02", weight_kg: "80" }),
    });
    await POST(request);

    expect(valuesMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userId: USER_B.id }),
    );
  });

  it("returns 503 when the database write fails", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    batchMock.mockRejectedValue(new Error("connection reset"));
    const { POST } = await import("./route");

    const response = await POST(
      jsonRequest({ measuredOn: "2026-08-02", weight_kg: "80" }),
    );

    expect(response.status).toBe(503);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
