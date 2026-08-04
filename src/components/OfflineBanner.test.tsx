import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { OfflineBanner } from "./OfflineBanner";
import { reportNetworkFailure } from "@/lib/pwa/use-online-status";

// A STABLE object reference across renders — real Next.js's useRouter()
// returns one from context (memoized); a mock recreating `{ refresh }`
// on every call would give useOnlineStatus's own `[router]` effect
// dependency a new identity on every state update, re-running the
// effect (and re-firing the mount-time probe) far more than once.
const { refreshMock, routerStub } = vi.hoisted(() => {
  const refreshMock = vi.fn();
  return { refreshMock, routerStub: { refresh: refreshMock } };
});
vi.mock("next/navigation", () => ({
  useRouter: () => routerStub,
}));

function healthyResponse(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function captivePortalResponse(): Response {
  // A captive portal answers 200 with HTML to any URL — res.json() throws.
  return new Response("<html>login</html>", {
    status: 200,
    headers: { "content-type": "text/html" },
  });
}

function serviceUnavailableResponse(): Response {
  return new Response(JSON.stringify({ ok: false }), {
    status: 503,
    headers: { "content-type": "application/json" },
  });
}

describe("OfflineBanner (s10 plan task 7, decision 20)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let onlineGetter: ReturnType<typeof vi.spyOn>;
  let isOnline: boolean;

  beforeEach(() => {
    isOnline = true;
    onlineGetter = vi
      .spyOn(window.navigator, "onLine", "get")
      .mockImplementation(() => isOnline);
    fetchMock = vi.fn().mockResolvedValue(healthyResponse());
    vi.stubGlobal("fetch", fetchMock);
    refreshMock.mockClear();
  });

  afterEach(() => {
    onlineGetter.mockRestore();
    vi.unstubAllGlobals();
  });

  it("shows nothing at the very first render — never a false hydration positive", () => {
    render(<OfflineBanner />);

    expect(screen.queryByText(/hors ligne/i)).toBeNull();
  });

  it("appears on the offline event, with its French text", async () => {
    render(<OfflineBanner />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    isOnline = false;
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(
      await screen.findByText(
        "Vous êtes hors ligne. Les données affichées peuvent être périmées.",
      ),
    ).toBeInTheDocument();
  });

  it("disappears on the online event AND calls router.refresh() — never location.reload()", async () => {
    isOnline = false;
    render(<OfflineBanner />);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(await screen.findByText(/hors ligne/i)).toBeInTheDocument();

    isOnline = true;
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => expect(screen.queryByText(/hors ligne/i)).toBeNull());
    expect(refreshMock).toHaveBeenCalled();
  });

  it("carries an accessible live region", async () => {
    isOnline = false;
    render(<OfflineBanner />);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    const banner = await screen.findByText(/hors ligne/i);
    // Alert (shadcn primitive) carries role="alert" by default — a live
    // region on its own, per the ARIA spec (implicit aria-live="assertive").
    expect(
      banner.closest('[role="alert"], [role="status"], [aria-live]'),
    ).not.toBeNull();
  });

  // The three cases that actually matter (decision 20's own reasoning):
  // navigator.onLine lies, the probe is what catches it.
  it("shows the banner when navigator.onLine is true but the probe fails (network error)", async () => {
    fetchMock.mockRejectedValue(new TypeError("network error"));
    render(<OfflineBanner />);

    expect(
      await screen.findByText(/hors ligne/i),
    ).toBeInTheDocument();
  });

  it("shows the banner when onLine is true and the probe gets a 200 with HTML (captive portal)", async () => {
    fetchMock.mockResolvedValue(captivePortalResponse());
    render(<OfflineBanner />);

    expect(await screen.findByText(/hors ligne/i)).toBeInTheDocument();
  });

  it("shows the banner when the probe returns 503", async () => {
    fetchMock.mockResolvedValue(serviceUnavailableResponse());
    render(<OfflineBanner />);

    expect(await screen.findByText(/hors ligne/i)).toBeInTheDocument();
  });

  it("shows no banner when the probe succeeds with 200 + { ok: true }", async () => {
    render(<OfflineBanner />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.queryByText(/hors ligne/i)).toBeNull();
  });

  // Decision 20/task 8: reportNetworkFailure() re-runs the same probe —
  // the form's own failed submission attempt feeds the banner without a
  // second, redundant check.
  it("re-probes and shows the banner when reportNetworkFailure() is called", async () => {
    render(<OfflineBanner />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fetchMock.mockResolvedValue(serviceUnavailableResponse());
    act(() => {
      reportNetworkFailure();
    });

    expect(await screen.findByText(/hors ligne/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("probes /api/health with cache: 'no-store'", async () => {
    render(<OfflineBanner />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/health",
        expect.objectContaining({ cache: "no-store" }),
      ),
    );
  });
});
