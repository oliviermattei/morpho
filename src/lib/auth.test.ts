import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Minimal shape of what src/lib/auth.ts actually passes to createNeonAuth() —
// just enough to type the mock below so TypeScript doesn't infer `calls` as
// zero-argument tuples (vi.fn(() => ({})) has no parameter to infer from).
type MockedCreateNeonAuthConfig = {
  cookies: { sessionDataTtl?: number; sameSite?: string };
  logLevel?: string;
};

// research Trap 5: createNeonAuth() throws synchronously when
// cookies.secret is missing or under 32 characters. If src/lib/auth.ts
// called it at module scope, importing this module during `npm run build`
// would break the build whenever NEON_AUTH_COOKIE_SECRET isn't populated —
// which is the case in this environment.
describe("auth instance (src/lib/auth) — build-safe laziness", () => {
  beforeEach(() => {
    delete process.env.NEON_AUTH_BASE_URL;
    delete process.env.NEON_AUTH_COOKIE_SECRET;
  });

  it("does not throw on import when the cookie secret is missing", async () => {
    await expect(import("./auth")).resolves.toBeDefined();
  });

  it("throws an explicit error when getAuth() is called without a cookie secret", async () => {
    const { getAuth } = await import("./auth");

    expect(() => getAuth()).toThrow(/cookies\.secret/i);
  });

  // plan task 3: "un secret trop court lève une erreur explicite" — distinct
  // from the missing-secret case above. The SDK validates both the same way
  // (research Trap 8: cookies.secret missing OR < 32 chars ⇒ throw), but the
  // plan calls out "too short" by name, so it gets its own test rather than
  // relying on the missing-secret one to stand in for it. One character
  // under the floor, to pin the boundary rather than an arbitrarily short
  // value.
  it("throws an explicit error when the cookie secret is present but under 32 characters", async () => {
    process.env.NEON_AUTH_BASE_URL = "https://example.neonauth.test";
    process.env.NEON_AUTH_COOKIE_SECRET = "a".repeat(31);

    const { getAuth } = await import("./auth");

    expect(() => getAuth()).toThrow(/32 characters/i);

    delete process.env.NEON_AUTH_BASE_URL;
    delete process.env.NEON_AUTH_COOKIE_SECRET;
  });
});

// plan task 3 + ADR 008: the config createNeonAuth() is actually called
// with is opaque once wrapped in the returned NeonAuth instance — the only
// way to assert on it is to intercept the call itself. createNeonAuth() is
// mocked per test (vi.doMock + vi.resetModules) so these tests don't touch
// a real Neon Auth instance and don't interfere with the unmocked describe
// block above, which relies on the real SDK's throw behavior.
describe("auth instance (src/lib/auth) — configuration (task 3)", () => {
  beforeEach(() => {
    process.env.NEON_AUTH_BASE_URL = "https://example.neonauth.test";
    process.env.NEON_AUTH_COOKIE_SECRET = "a".repeat(32);
    // Force a fresh "./auth" module for every test in this block: the
    // describe block above may have already imported (and cached) the real
    // "./auth" — reusing that cached module would bind to the real
    // createNeonAuth instead of the mock registered below.
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.NEON_AUTH_BASE_URL;
    delete process.env.NEON_AUTH_COOKIE_SECRET;
    vi.doUnmock("@neondatabase/auth/next/server");
    vi.resetModules();
  });

  it("configures cookies.sameSite as 'lax' — ADR 008, not the SDK's 'strict' default", async () => {
    const createNeonAuthMock = vi.fn(() => ({}));
    vi.doMock("@neondatabase/auth/next/server", () => ({
      createNeonAuth: createNeonAuthMock,
    }));

    const { getAuth } = await import("./auth");
    getAuth();

    expect(createNeonAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cookies: expect.objectContaining({ sameSite: "lax" }),
      }),
    );
  });

  it("declares cookies.sessionDataTtl explicitly, rather than relying on the SDK default", async () => {
    const createNeonAuthMock = vi.fn<(config: MockedCreateNeonAuthConfig) => object>(
      () => ({}),
    );
    vi.doMock("@neondatabase/auth/next/server", () => ({
      createNeonAuth: createNeonAuthMock,
    }));

    const { getAuth } = await import("./auth");
    getAuth();

    const config = createNeonAuthMock.mock.calls[0][0];
    expect(typeof config.cookies.sessionDataTtl).toBe("number");
  });

  it("declares an explicit logLevel, rather than relying on the SDK default", async () => {
    const createNeonAuthMock = vi.fn<(config: MockedCreateNeonAuthConfig) => object>(
      () => ({}),
    );
    vi.doMock("@neondatabase/auth/next/server", () => ({
      createNeonAuth: createNeonAuthMock,
    }));

    const { getAuth } = await import("./auth");
    getAuth();

    const config = createNeonAuthMock.mock.calls[0][0];
    expect(typeof config.logLevel).toBe("string");
  });
});
