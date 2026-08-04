import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, updateSession } from "./sessions";

// s09 plan P6/C6: the ONE place MeasurementSessionForm's fetch calls
// live, so the shared component branches on props.mode without ever
// importing server code or forking. Tested here in isolation from the
// component, which only has to prove it calls the right one (task 7).
describe("src/lib/api/sessions", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("createSession POSTs to /api/sessions with a JSON content-type", async () => {
    await createSession({ measuredOn: "2026-08-02", weight_kg: "80" });

    expect(fetchMock).toHaveBeenCalledWith("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ measuredOn: "2026-08-02", weight_kg: "80" }),
    });
  });

  it("updateSession PATCHes /api/sessions/<id> with the same content-type", async () => {
    await updateSession("session-1", {
      measuredOn: "2026-08-02",
      weight_kg: "80",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/sessions/session-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ measuredOn: "2026-08-02", weight_kg: "80" }),
    });
  });
});
