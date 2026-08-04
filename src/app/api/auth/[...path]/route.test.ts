import { describe, expect, it, vi } from "vitest";

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
});
