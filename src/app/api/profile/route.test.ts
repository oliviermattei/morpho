import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthMock, getSessionMock } = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuth: getAuthMock }));

// getDb() is called inside the handler, never at module scope (s01
// review, finding D) — same motif as src/app/api/sessions/route.ts.
const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: getDbMock }));

const { saveHeightMock, saveTargetWeightMock } = vi.hoisted(() => ({
  saveHeightMock: vi.fn(),
  saveTargetWeightMock: vi.fn(),
}));
vi.mock("@/lib/profile", () => ({
  saveHeight: saveHeightMock,
  saveTargetWeight: saveTargetWeightMock,
}));

// Both fields go through the same single form / same single PUT (s08
// task 6, "même formulaire, même bouton") — a valid target is included
// on every request that isn't itself testing the target field, so the
// height-only tests below aren't accidentally exercising target
// validation instead of what they say they test, and vice versa.
const VALID_TARGET = "72";

function jsonRequest(body: unknown, init?: RequestInit): Request {
  return new Request("https://morpho.test/api/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });
}

const USER_B = { id: "user-b", email: "b@example.test" };
const DB_STUB = { __stub: "db" };

describe("PUT /api/profile", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getAuthMock.mockReset();
    getAuthMock.mockReturnValue({ getSession: getSessionMock });
    getSessionMock.mockReset();
    getDbMock.mockReset();
    getDbMock.mockReturnValue(DB_STUB);
    saveHeightMock.mockReset();
    saveHeightMock.mockResolvedValue(undefined);
    saveTargetWeightMock.mockReset();
    saveTargetWeightMock.mockResolvedValue(undefined);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("exports dynamic = 'force-dynamic' — every page/route calling getAuth() must (plan decision, s01/s02/s03 precedent)", async () => {
    const routeModule = await import("./route");
    expect(routeModule.dynamic).toBe("force-dynamic");
  });

  it("returns 401 without a session, without touching the database", async () => {
    getSessionMock.mockResolvedValue({ data: null, error: null });
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: "175", targetWeightKg: VALID_TARGET }),
    );

    expect(response.status).toBe(401);
    expect(getDbMock).not.toHaveBeenCalled();
    expect(saveHeightMock).not.toHaveBeenCalled();
    expect(saveTargetWeightMock).not.toHaveBeenCalled();
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
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: "175", targetWeightKg: VALID_TARGET }),
    );

    expect(response.status).toBe(503);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  // Review finding 5: the two other 503 paths (auth server 5xx above,
  // storage failure below) each have a test — this third one, getAuth()
  // itself throwing, did not. It's exactly the path createNeonAuth()
  // takes when its config is missing (src/app/api/session/route.test.ts
  // covers the same case for that handler).
  it("returns 503 when getAuth() throws — e.g. a missing cookie secret — not a raw 500", async () => {
    getAuthMock.mockImplementation(() => {
      throw new Error("cookies.secret must be at least 32 characters");
    });
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: "175", targetWeightKg: VALID_TARGET }),
    );

    expect(response.status).toBe(503);
    expect(getDbMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("returns 503 when getSession() rejects with an unclassified error — not a raw 500", async () => {
    getSessionMock.mockRejectedValue(new Error("fetch failed"));
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: "175", targetWeightKg: VALID_TARGET }),
    );

    expect(response.status).toBe(503);
    expect(getDbMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("returns 400 on an out-of-range height, without writing", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: "300", targetWeightKg: VALID_TARGET }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.heightCm).toBeDefined();
    expect(saveHeightMock).not.toHaveBeenCalled();
    expect(saveTargetWeightMock).not.toHaveBeenCalled();
  });

  it("returns 400 on an unparseable height, without writing", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: "abc", targetWeightKg: VALID_TARGET }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.heightCm).toBeDefined();
    expect(saveHeightMock).not.toHaveBeenCalled();
  });

  // Review finding 2: absent is not empty. An explicit "" is the R7
  // erase signal (test below); a heightCm the request never sent at all
  // must never collapse into that same signal and silently wipe the
  // stored height.
  it("returns 400 without writing when heightCm is absent from the body", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    const { PUT } = await import("./route");

    const response = await PUT(jsonRequest({ targetWeightKg: VALID_TARGET }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.heightCm).toBeDefined();
    expect(saveHeightMock).not.toHaveBeenCalled();
  });

  // Same class: a non-string heightCm (e.g. a JSON number) must not
  // collapse into "" either.
  it("returns 400 without writing when heightCm is not a string", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: 175, targetWeightKg: VALID_TARGET }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.heightCm).toBeDefined();
    expect(saveHeightMock).not.toHaveBeenCalled();
  });

  it("returns 400 without writing when the request body is not valid JSON", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    const { PUT } = await import("./route");

    const request = new Request("https://morpho.test/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.heightCm).toBeDefined();
    expect(saveHeightMock).not.toHaveBeenCalled();
  });

  it("saves the height under the session's own identity on 200", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: "175,5", targetWeightKg: VALID_TARGET }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.heightCm).toBe(175.5);
    expect(saveHeightMock).toHaveBeenCalledWith(DB_STUB, USER_B.id, 175.5);
  });

  it("saves null for the height when the field is emptied (R7)", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: "", targetWeightKg: VALID_TARGET }),
    );

    expect(response.status).toBe(200);
    expect(saveHeightMock).toHaveBeenCalledWith(DB_STUB, USER_B.id, null);
  });

  it("returns 503 when the database write fails", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    saveHeightMock.mockRejectedValue(new Error("connection reset"));
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: "175", targetWeightKg: VALID_TARGET }),
    );

    expect(response.status).toBe(503);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  // Criterion, security: identity always comes from the verified session,
  // never from anything the client sent (AGENTS.md, non-negotiable) — the
  // same forgery surfaces src/app/api/sessions/route.test.ts covers.
  // Trap 18 (s08): a target-weight payload is just as much a POST/PUT
  // surface as the height one, so this is re-verified with the target
  // field present too.
  it("ignores a user_id forged in the payload", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    const { PUT } = await import("./route");

    await PUT(
      jsonRequest({
        heightCm: "175",
        targetWeightKg: VALID_TARGET,
        user_id: "user-a",
      }),
    );

    expect(saveHeightMock).toHaveBeenCalledWith(DB_STUB, USER_B.id, 175);
    expect(saveTargetWeightMock).toHaveBeenCalledWith(DB_STUB, USER_B.id, 72);
  });

  it("ignores a user_id forged into the query string", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    const { PUT } = await import("./route");

    const request = new Request(
      "https://morpho.test/api/profile?user_id=user-a",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ heightCm: "175", targetWeightKg: VALID_TARGET }),
      },
    );
    await PUT(request);

    expect(saveHeightMock).toHaveBeenCalledWith(DB_STUB, USER_B.id, 175);
  });

  it("ignores a user_id forged into a request header", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: USER_B, session: { id: "session-b" } },
      error: null,
    });
    const { PUT } = await import("./route");

    const request = new Request("https://morpho.test/api/profile", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-user-id": "user-a",
      },
      body: JSON.stringify({ heightCm: "175", targetWeightKg: VALID_TARGET }),
    });
    await PUT(request);

    expect(saveHeightMock).toHaveBeenCalledWith(DB_STUB, USER_B.id, 175);
  });
});

// s08 task 5: the target weight field, validated the same way the
// height field already is — through parseMeasurementInput (trap 11),
// never z.coerce.number(), and never a second endpoint.
describe("PUT /api/profile — target weight (s08 task 5)", () => {
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
    saveHeightMock.mockReset();
    saveHeightMock.mockResolvedValue(undefined);
    saveTargetWeightMock.mockReset();
    saveTargetWeightMock.mockResolvedValue(undefined);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("saves null — not 0 — when the target field is emptied", async () => {
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: "175", targetWeightKg: "" }),
    );

    expect(response.status).toBe(200);
    expect(saveTargetWeightMock).toHaveBeenCalledWith(DB_STUB, USER_B.id, null);
  });

  it("saves null when the target field is whitespace only", async () => {
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: "175", targetWeightKg: "   " }),
    );

    expect(response.status).toBe(200);
    expect(saveTargetWeightMock).toHaveBeenCalledWith(DB_STUB, USER_B.id, null);
  });

  it("accepts a French comma decimal", async () => {
    const { PUT } = await import("./route");

    await PUT(jsonRequest({ heightCm: "175", targetWeightKg: "70,5" }));

    expect(saveTargetWeightMock).toHaveBeenCalledWith(DB_STUB, USER_B.id, 70.5);
  });

  it("accepts a dot decimal", async () => {
    const { PUT } = await import("./route");

    await PUT(jsonRequest({ heightCm: "175", targetWeightKg: "70.5" }));

    expect(saveTargetWeightMock).toHaveBeenCalledWith(DB_STUB, USER_B.id, 70.5);
  });

  it("rounds to one decimal (parseMeasurementInput's rule)", async () => {
    const { PUT } = await import("./route");

    await PUT(jsonRequest({ heightCm: "175", targetWeightKg: "70,55" }));

    expect(saveTargetWeightMock).toHaveBeenCalledWith(DB_STUB, USER_B.id, 70.6);
  });

  it("returns 400 for a target below the physiological range, with a message naming both bounds, without writing", async () => {
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: "175", targetWeightKg: "0" }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.targetWeightKg[0]).toContain("20");
    expect(body.fieldErrors.targetWeightKg[0]).toContain("400");
    expect(saveTargetWeightMock).not.toHaveBeenCalled();
    expect(saveHeightMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a target above the physiological range, without writing", async () => {
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: "175", targetWeightKg: "999" }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.targetWeightKg).toBeDefined();
    expect(saveTargetWeightMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an unparseable target, without writing", async () => {
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: "175", targetWeightKg: "abc" }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.targetWeightKg).toBeDefined();
    expect(saveTargetWeightMock).not.toHaveBeenCalled();
  });

  it("returns 400 without writing when targetWeightKg is absent from the body", async () => {
    const { PUT } = await import("./route");

    const response = await PUT(jsonRequest({ heightCm: "175" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.targetWeightKg).toBeDefined();
    expect(saveTargetWeightMock).not.toHaveBeenCalled();
  });

  // A user_id in the target-weight payload is exactly as forgeable a
  // surface as the height one (trap 18) — re-verified here rather than
  // assumed from the height-field test above.
  it("ignores a user_id forged alongside a valid target", async () => {
    const { PUT } = await import("./route");

    await PUT(
      jsonRequest({
        heightCm: "175",
        targetWeightKg: "72",
        user_id: "user-a",
      }),
    );

    expect(saveTargetWeightMock).toHaveBeenCalledWith(DB_STUB, USER_B.id, 72);
  });

  it("returns 503 when saving the target fails", async () => {
    saveTargetWeightMock.mockRejectedValue(new Error("connection reset"));
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: "175", targetWeightKg: "72" }),
    );

    expect(response.status).toBe(503);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  // Both fields are validated before either is written — a single
  // multi-field response, not a fail-fast on whichever field the
  // handler happens to check first.
  it("reports errors for BOTH fields at once when both are invalid, and writes neither", async () => {
    const { PUT } = await import("./route");

    const response = await PUT(
      jsonRequest({ heightCm: "abc", targetWeightKg: "999" }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.heightCm).toBeDefined();
    expect(body.fieldErrors.targetWeightKg).toBeDefined();
    expect(saveHeightMock).not.toHaveBeenCalled();
    expect(saveTargetWeightMock).not.toHaveBeenCalled();
  });

  it("does not call revalidatePath — this route is the only write path (decision 10)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(
      resolve(import.meta.dirname, "route.ts"),
      "utf8",
    );
    expect(source).not.toContain("revalidatePath");
  });
});
