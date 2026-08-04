"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ProbeTrigger = () => void;

// s10 plan task 8, decision 20: the capture form's own network-failure
// path (decision 11's path (b)) reports here so the SAME probe the
// banner relies on re-runs immediately — never a second, independent
// check duplicating this one.
const probeTriggers = new Set<ProbeTrigger>();

export function reportNetworkFailure(): void {
  for (const trigger of probeTriggers) trigger();
}

/**
 * decision 20: `navigator.onLine` only reports whether an interface is
 * active, not whether it can actually reach the internet (a portal
 * captif, an unplugged box). `/api/health` is NetworkOnly (decision 1a)
 * and outside the proxy's matcher (s01 criterion 4) — a real,
 * unauthenticated round trip. "Healthy" requires BOTH a 2xx status AND a
 * parseable `{ ok: true }` body: a captive portal answers 200 with HTML
 * to any URL, and `res.json()` throwing on that is what catches it.
 */
async function probeIsHealthy(): Promise<boolean> {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) return false;
    const body = (await response.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  }
}

/**
 * s10 plan task 7, decision 20: `isStale = !navigator.onLine ||
 * lastProbeFailed`. SSR-safe: `navigator.onLine` doesn't exist on the
 * server, and reading it during the initial render would diverge
 * between server and client — starts `true` (never flags stale at
 * first paint), corrected right after mount, same motif as
 * `MeasurementSessionForm`'s own client-only default-date effect (s03
 * decision 9).
 *
 * The probe runs on exactly four triggers — mount, `online`,
 * `visibilitychange` → visible, and `reportNetworkFailure()` — NEVER on
 * an interval.
 */
export function useOnlineStatus(): { isStale: boolean } {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [lastProbeFailed, setLastProbeFailed] = useState(false);
  // Same one-time-sync guard as MeasurementSessionForm's own client-only
  // default-date effect (s03 decision 9): a synchronous setState call
  // directly in an effect body is otherwise flagged
  // (react-hooks/set-state-in-effect) as a possible cascading-render
  // smell — this one is a deliberate, guarded, one-time SSR correction.
  const hasSyncedInitialOnlineState = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function runProbe() {
      const healthy = await probeIsHealthy();
      if (!cancelled) setLastProbeFailed(!healthy);
    }

    function handleOnline() {
      setIsOnline(true);
      void runProbe();
      // decision 17: a maison refresh, never location.reload() — a
      // reload would drop whatever the user was mid-typing.
      router.refresh();
    }

    function handleOffline() {
      setIsOnline(false);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void runProbe();
      }
    }

    if (!hasSyncedInitialOnlineState.current) {
      hasSyncedInitialOnlineState.current = true;
      setIsOnline(navigator.onLine);
    }
    void runProbe();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    probeTriggers.add(runProbe);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      probeTriggers.delete(runProbe);
    };
  }, [router]);

  return { isStale: !isOnline || lastProbeFailed };
}
