// @vitest-environment node
//
// Review s01, second pass, finding H: under the default jsdom environment,
// window and document both exist, so the Neon driver's browser check
// (@neondatabase/serverless) fires its "Running SQL directly from the
// browser" warning on every query this file makes — pure noise in
// npm run check. This file exercises the real driver against Node's
// fetch, never the DOM, so node is also the correct environment.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

// research Trap 5: createNeonAuth() throws at construction without a secret.
// neon() has the same failure mode — it throws synchronously without a
// connection string. Both must therefore be lazy, or `npm run build` breaks
// locally whenever DATABASE_URL isn't populated.
describe("db client (src/lib/db) — build-safe laziness", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("does not throw on import when DATABASE_URL is missing", async () => {
    await expect(import("./index")).resolves.toBeDefined();
  });

  it("throws only once getSql() is actually called without DATABASE_URL", async () => {
    const { getSql } = await import("./index");

    expect(() => getSql()).toThrow();
  });
});

// Review finding 1 (critical): the original code called
// `AbortSignal.timeout(5000)` once, at first construction, and froze it into
// a memoised client. The timer starts at construction, not at query time, so
// every query issued more than 5s after the first one aborted before
// leaving the process — invisible in dev, permanent on a warm serverless
// instance. This exercises the real @neondatabase/serverless driver (only
// `fetch` is stubbed, no real database) and asserts the mechanics it
// actually depends on: a fresh `AbortSignal.timeout()` per query, never one
// shared instance reused across queries.
describe("db client (src/lib/db) — per-query abort signal", () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      fields: [{ name: "result", dataTypeID: 23 }],
      rows: [[1]],
    }),
  }));

  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = "postgres://user:pass@ep-test.neon.tech/db";
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.DATABASE_URL;
  });

  it("creates a fresh AbortSignal for every query, not once for the module's lifetime", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const { getSql } = await import("./index");

    await getSql()`select 1`;
    await getSql()`select 1`;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The bug: AbortSignal.timeout() ran once, at the first getSql() call,
    // and the resulting signal was frozen into the memoised client — reused,
    // unaborted at test time, but doomed 5s later in production for every
    // later query.
    expect(timeoutSpy).toHaveBeenCalledTimes(2);

    // Corollary: two separate queries must never share the same signal
    // instance — sharing is exactly what lets one query's elapsed time
    // expire a later, unrelated query.
    const [, firstInit] = fetchMock.mock.calls[0] as unknown as [
      unknown,
      RequestInit,
    ];
    const [, secondInit] = fetchMock.mock.calls[1] as unknown as [
      unknown,
      RequestInit,
    ];
    expect(firstInit.signal).not.toBe(secondInit.signal);
  });
});

// Review s01, second pass, finding D: getDb() delegates to getSql(), so it
// inherits the same freshness invariant — but that invariant only holds if
// callers call getDb() itself fresh, per request. The natural idiom a
// future story reaches for, `const db = getDb()` at module scope, would
// memoise the drizzle instance (and the AbortSignal frozen inside it) for
// the life of the serverless instance — the exact critical bug review
// finding 1 fixed, with the same profile, one layer up. This test locks in
// that getDb() itself stays cheap and side-effect-free to call repeatedly.
describe("db client (src/lib/db) — getDb() freshness", () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      fields: [{ name: "result", dataTypeID: 23 }],
      rows: [[1]],
    }),
  }));

  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = "postgres://user:pass@ep-test.neon.tech/db";
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.DATABASE_URL;
  });

  it("builds a fresh drizzle instance on every call, never memoised across queries", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const { getDb } = await import("./index");

    await getDb().execute(sql`select 1`);
    await getDb().execute(sql`select 1`);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Same corollary as getSql(): each getDb() call must carry its own
    // AbortSignal, never one shared instance reused across queries — that
    // sharing is exactly what would let one query's elapsed time expire a
    // later, unrelated query on a warm serverless instance.
    expect(timeoutSpy).toHaveBeenCalledTimes(2);
    const [, firstInit] = fetchMock.mock.calls[0] as unknown as [
      unknown,
      RequestInit,
    ];
    const [, secondInit] = fetchMock.mock.calls[1] as unknown as [
      unknown,
      RequestInit,
    ];
    expect(firstInit.signal).not.toBe(secondInit.signal);
  });
});
