import { NextResponse } from "next/server";
import { NEON_AUTH_NETWORK_ERROR_CODES } from "@neondatabase/auth/next/server";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { measurements, measurementSessions } from "@/lib/db/schema";
import { parseMeasurementSessionInput } from "@/lib/measurement-session-input";

// Every page/route that calls getAuth() needs this (plan decision 20) —
// createNeonAuth() validates its config synchronously and throws before
// the SDK ever reaches cookies(), so Next never auto-switches the route to
// dynamic on its own.
export const dynamic = "force-dynamic";

// Same taxonomy as src/app/api/session/route.ts (plan task 5: "réutiliser
// la taxonomie"): a genuine transport/server failure is 503; an upstream
// 4xx (expired or forged token) is "no valid session", 401.
const TRANSPORT_OR_SERVER_ERROR_CODES: readonly string[] = [
  ...NEON_AUTH_NETWORK_ERROR_CODES,
  "INTERNAL_ERROR",
];

function isTransportOrServerFailure(error: {
  status: number;
  code?: string;
}): boolean {
  return (
    error.status >= 500 ||
    error.status === 408 ||
    error.status === 429 ||
    (error.code !== undefined &&
      TRANSPORT_OR_SERVER_ERROR_CODES.includes(error.code))
  );
}

export async function POST(request: Request) {
  let data: Awaited<
    ReturnType<ReturnType<typeof getAuth>["getSession"]>
  >["data"];
  let error: Awaited<
    ReturnType<ReturnType<typeof getAuth>["getSession"]>
  >["error"];

  try {
    ({ data, error } = await getAuth().getSession());
  } catch (thrown) {
    console.error(
      "[sessions] getAuth()/getSession() threw",
      thrown instanceof Error ? thrown.name : typeof thrown,
    );
    return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
  }

  if (error) {
    if (isTransportOrServerFailure(error)) {
      console.error(
        "[sessions] auth server reported a transport/server failure",
        error.status,
        error.code,
      );
      return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!data?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Identity always comes from the verified session, never from the
  // request body (AGENTS.md, non-negotiable; criterion 7 — a forged
  // user_id in the payload below is never read).
  const userId = data.user.id;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = undefined;
  }

  const parsed = parseMeasurementSessionInput(payload);
  if (!parsed.ok) {
    // Criterion 4, second half: nothing is persisted on this path — no
    // getDb() call happens above or below this return.
    return NextResponse.json(
      { fieldErrors: parsed.fieldErrors, formErrors: parsed.formErrors },
      { status: 400 },
    );
  }

  // Plan decision 10: neon-http has no transaction() (it throws — verified
  // in the installed package). db.batch() is a real single-round-trip
  // transaction; it doesn't chain a RETURNING into the next query, hence
  // the app-generated id here.
  const sessionId = crypto.randomUUID();

  try {
    const db = getDb();
    await db.batch([
      db.insert(measurementSessions).values({
        id: sessionId,
        userId,
        measuredOn: parsed.value.measuredOn,
      }),
      db.insert(measurements).values(
        parsed.value.measurements.map((measurement) => ({
          id: crypto.randomUUID(),
          sessionId,
          kind: measurement.kind,
          value: measurement.value,
        })),
      ),
    ]);
  } catch (thrown) {
    console.error(
      "[sessions] failed to persist a measurement session",
      thrown instanceof Error ? thrown.name : typeof thrown,
    );
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }

  return NextResponse.json({ id: sessionId }, { status: 201 });
}
