import { afterEach, describe, expect, it, vi } from "vitest";

const { getAuthMock } = vi.hoisted(() => ({ getAuthMock: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getAuth: getAuthMock }));

// plan task 4: this route is the SDK's own catch-all proxy for every
// /api/auth/** request (sign-in, magic-link send, session refresh…). The
// only behaviour that belongs to morpho here is wiring GET/POST to
// getAuth().handler() — the handler's own behaviour is the SDK's, already
// exercised by the SDK's own tests, not ours to re-verify.
//
// Deliberately calling getAuth() inside each verb, not
// `export const { GET, POST } = getAuth().handler()` at module scope: the
// latter was tried first and reproducibly broke `next build` without
// secrets (`Error: Missing required config: cookies.secret` during
// "Collecting page data") — the same module-scope-construction trap
// documented for src/lib/auth.ts (research Trap 8) and src/lib/db/index.ts,
// just one layer up. These tests assert the delegation contract (call goes
// through, response comes back) rather than reference equality of GET/POST
// to the SDK's own functions, because that equality no longer holds once
// the call is deferred.
describe("/api/auth/[...path] route", () => {
  it("exports GET and POST as functions", async () => {
    getAuthMock.mockReturnValue({
      handler: () => ({ GET: vi.fn(), POST: vi.fn() }),
    });

    const route = await import("./route");

    expect(typeof route.GET).toBe("function");
    expect(typeof route.POST).toBe("function");
  });

  it("GET delegates to getAuth().handler().GET with the same request and params, and returns its response", async () => {
    const expectedResponse = new Response("ok");
    const handlerGet = vi.fn(async () => expectedResponse);
    getAuthMock.mockReturnValue({
      handler: () => ({ GET: handlerGet, POST: vi.fn() }),
    });
    const { GET } = await import("./route");

    const request = new Request("https://morpho.test/api/auth/get-session");
    const context = { params: Promise.resolve({ path: ["get-session"] }) };
    const response = await GET(request, context);

    expect(handlerGet).toHaveBeenCalledWith(request, context);
    expect(response).toBe(expectedResponse);
  });

  it("POST delegates to getAuth().handler().POST with the same request and params, and returns its response", async () => {
    const expectedResponse = new Response("ok");
    const handlerPost = vi.fn(async () => expectedResponse);
    getAuthMock.mockReturnValue({
      handler: () => ({ GET: vi.fn(), POST: handlerPost }),
    });
    const { POST } = await import("./route");

    const request = new Request("https://morpho.test/api/auth/sign-in/magic-link", {
      method: "POST",
    });
    const context = { params: Promise.resolve({ path: ["sign-in", "magic-link"] }) };
    const response = await POST(request, context);

    expect(handlerPost).toHaveBeenCalledWith(request, context);
    expect(response).toBe(expectedResponse);
  });

  // The one piece of behaviour that IS morpho's here rather than the SDK's.
  // The screen also hides the form when sign-up is off, but /api/auth/
  // sign-up/email is public — reachable with a single curl, without ever
  // loading the screen — so a UI-only gate would close the door and leave
  // the window open.
  describe("the SIGNUP_ENABLED gate on sign-up", () => {
    const originalFlag = process.env.SIGNUP_ENABLED;

    afterEach(() => {
      if (originalFlag === undefined) delete process.env.SIGNUP_ENABLED;
      else process.env.SIGNUP_ENABLED = originalFlag;
    });

    function signUpRequest() {
      return {
        request: new Request("https://morpho.test/api/auth/sign-up/email", {
          method: "POST",
        }),
        context: { params: Promise.resolve({ path: ["sign-up", "email"] }) },
      };
    }

    // Only the exact string opens it: an unset variable on a fresh
    // deployment, a typo, or a truthy-looking "1" must all stay closed
    // rather than fall open.
    it.each([undefined, "", "1", "yes", "TRUE", "false"])(
      "answers 403 and never reaches the SDK when the flag is %j",
      async (value) => {
        if (value === undefined) delete process.env.SIGNUP_ENABLED;
        else process.env.SIGNUP_ENABLED = value;
        const handlerPost = vi.fn(async () => new Response("ok"));
        getAuthMock.mockReturnValue({
          handler: () => ({ GET: vi.fn(), POST: handlerPost }),
        });
        const { POST } = await import("./route");
        const { request, context } = signUpRequest();

        const response = await POST(request, context);

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
          code: "SIGNUP_DISABLED",
        });
        expect(handlerPost).not.toHaveBeenCalled();
      },
    );

    it("delegates to the SDK when the flag is exactly 'true'", async () => {
      process.env.SIGNUP_ENABLED = "true";
      const expectedResponse = new Response("ok");
      const handlerPost = vi.fn(async () => expectedResponse);
      getAuthMock.mockReturnValue({
        handler: () => ({ GET: vi.fn(), POST: handlerPost }),
      });
      const { POST } = await import("./route");
      const { request, context } = signUpRequest();

      const response = await POST(request, context);

      expect(handlerPost).toHaveBeenCalledWith(request, context);
      expect(response).toBe(expectedResponse);
    });

    // The gate has to be surgical: closing registration cannot take
    // sign-in, sign-out or session refresh down with it. The last two
    // paths are near-misses on the guarded one, so the comparison cannot
    // degrade into a prefix or substring match.
    it.each([
      [["sign-in", "email"]],
      [["sign-out"]],
      [["request-password-reset"]],
      [["sign-up"]],
      [["sign-up", "email", "extra"]],
    ])("still delegates %j with sign-up closed", async (path) => {
      delete process.env.SIGNUP_ENABLED;
      const handlerPost = vi.fn(async () => new Response("ok"));
      getAuthMock.mockReturnValue({
        handler: () => ({ GET: vi.fn(), POST: handlerPost }),
      });
      const { POST } = await import("./route");

      const response = await POST(
        new Request("https://morpho.test/api/auth/whatever", {
          method: "POST",
        }),
        { params: Promise.resolve({ path }) },
      );

      expect(response.status).toBe(200);
      expect(handlerPost).toHaveBeenCalledTimes(1);
    });

    // GET /api/auth/** carries session reads, never account creation.
    it("never gates GET", async () => {
      delete process.env.SIGNUP_ENABLED;
      const handlerGet = vi.fn(async () => new Response("ok"));
      getAuthMock.mockReturnValue({
        handler: () => ({ GET: handlerGet, POST: vi.fn() }),
      });
      const { GET } = await import("./route");

      const response = await GET(
        new Request("https://morpho.test/api/auth/get-session"),
        { params: Promise.resolve({ path: ["sign-up", "email"] }) },
      );

      expect(response.status).toBe(200);
      expect(handlerGet).toHaveBeenCalledTimes(1);
    });
  });
});
