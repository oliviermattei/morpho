import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { NEON_AUTH_NETWORK_ERROR_CODES } from "@neondatabase/auth/next/server";

// s01 acceptance criterion 3. auth.middleware() redirects (307) instead of
// returning 401 (research/ADR 003), so the 401 has to be produced here, by
// the handler itself. src/proxy.ts is out of scope for this story (plan
// decision 5) — s02 introduces it once the session exchange needs it.

// Review finding 2: getSession()'s error carries the upstream HTTP status
// (NeonAuthServerApiError.status) — it is not always a transport failure.
// Only genuine transport/server failures are a 503; the network error codes
// below and the driver's own "INTERNAL_ERROR" cover that. Everything else
// (in practice, any 4xx: an expired or forged token) is "no valid session",
// i.e. 401 — not an infra outage.
const TRANSPORT_OR_SERVER_ERROR_CODES: readonly string[] = [
  ...NEON_AUTH_NETWORK_ERROR_CODES,
  "INTERNAL_ERROR",
];

// Review s01 second pass, finding F, same class of assumption as finding 2
// but in the other direction: 408 (request timeout) and 429 (rate limited)
// are nominally 4xx, but the auth server never got to evaluate the token —
// it's a transport/capacity failure, not "no valid session". Treating them
// as 401 would tell the client its credentials were bad when the real
// problem is upstream.
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

export async function GET() {
  let data: Awaited<
    ReturnType<ReturnType<typeof getAuth>["getSession"]>
  >["data"];
  let error: Awaited<
    ReturnType<ReturnType<typeof getAuth>["getSession"]>
  >["error"];

  try {
    ({ data, error } = await getAuth().getSession());
  } catch (thrown) {
    // Review finding 4: getAuth() throws synchronously when the cookie
    // secret is missing or too short (src/lib/auth.ts), and getSession()
    // re-throws fetch failures it doesn't classify as transport errors,
    // instead of returning { error }. Both are infra problems, not "no
    // session" — 503, like any other transport/server failure, not an
    // uncontrolled 500. Review s01 second pass, finding E: this catch turns
    // any handler bug into "503 infra failure" — acceptable, but only if
    // it's traced. Logs the error's name only, never its message: an
    // unclassified fetch failure could echo back request details.
    console.error(
      "[session] getAuth()/getSession() threw",
      thrown instanceof Error ? thrown.name : typeof thrown,
    );
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  // plan decision 6, refined by review finding 2: distinguish "no session"
  // and "upstream 4xx" (both 401) from a genuine transport/server failure
  // (503). A 401 for an infra outage would lie to the client; a 503 for an
  // expired or forged token would fail criterion 3.
  if (error) {
    if (isTransportOrServerFailure(error)) {
      // Review s01 second pass, finding E: trace the outage. status and
      // code are auth-server metadata, never the connection string or a
      // token — safe to log.
      console.error(
        "[session] auth server reported a transport/server failure",
        error.status,
        error.code,
      );
      return NextResponse.json({ ok: false }, { status: 503 });
    }
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!data?.user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Identity always comes from the verified session token, never from
  // anything the client sent (morpho/AGENTS.md — non-negotiable).
  return NextResponse.json(
    { user: { id: data.user.id, email: data.user.email } },
    { status: 200 },
  );
}
