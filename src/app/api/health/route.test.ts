import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSqlMock } = vi.hoisted(() => ({ getSqlMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getSql: getSqlMock,
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    getSqlMock.mockReset();
  });

  it("returns 200 { ok: true } when the database answers", async () => {
    getSqlMock.mockReturnValue(
      vi.fn(() => Promise.resolve([{ "?column?": 1 }])),
    );
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 503 { ok: false } on failure, without leaking the error or the host", async () => {
    getSqlMock.mockReturnValue(
      vi.fn(() =>
        Promise.reject(
          new Error("postgres://sentineluser:sentinelpass@ep-sentinel.neon.tech/neondb timeout"),
        ),
      ),
    );
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain("postgres://");
    expect(body).not.toContain("neon.tech");
    expect(JSON.parse(body)).toEqual({ ok: false });
  });

  // Review s01, second pass, finding E: a 503 here means Neon is
  // unreachable in production — silent, nothing traces it. This asserts
  // both that the failure is logged, and that the log itself never carries
  // the connection string (research Trap 3 applies to logs too, not just
  // the response body).
  it("logs the failure via console.error without leaking the connection string", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    getSqlMock.mockReturnValue(
      vi.fn(() =>
        Promise.reject(
          new Error("postgres://sentineluser:sentinelpass@ep-sentinel.neon.tech/neondb timeout"),
        ),
      ),
    );
    const { GET } = await import("./route");

    await GET();

    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedArgs = consoleErrorSpy.mock.calls.flat().map(String).join(" ");
    expect(loggedArgs).not.toContain("postgres://");
    expect(loggedArgs).not.toContain("neon.tech");
    expect(loggedArgs).not.toContain("sentinelpass");

    consoleErrorSpy.mockRestore();
  });
});
