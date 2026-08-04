import type { MeasurementKind } from "@/lib/measurements";

/**
 * s09 plan P6/C6: the shape MeasurementSessionForm sends, whichever mode
 * it's in — one raw string per measurement kind (never normalized
 * client-side, criterion 5) plus the date. Partial, not a full Record:
 * MeasurementSessionForm's own `values` state always carries all 10 keys
 * in practice, but the endpoint itself (both POST and PATCH) accepts a
 * payload missing a kind entirely exactly like one carrying "" for it —
 * this type says so rather than overclaiming completeness.
 */
export type MeasurementSessionPayload = { measuredOn: string } & Partial<
  Record<MeasurementKind, string>
>;

const JSON_HEADERS = { "content-type": "application/json" } as const;

/**
 * POST /api/sessions (s03). The ONE fetch call this path uses — moving
 * it here, out of MeasurementSessionForm.tsx, is what lets the same
 * component branch on `props.mode` without importing server code or
 * forking (P6): no server module is ever imported by a client component,
 * no fetch call is passed around as a prop.
 */
export function createSession(
  payload: MeasurementSessionPayload,
): Promise<Response> {
  return fetch("/api/sessions", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
}

/**
 * PATCH /api/sessions/[id] (s09 task 6) — the update half of P6.
 */
export function updateSession(
  sessionId: string,
  payload: MeasurementSessionPayload,
): Promise<Response> {
  return fetch(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
}
