import { NextResponse } from "next/server";
import { NEON_AUTH_NETWORK_ERROR_CODES } from "@neondatabase/auth/next/server";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deleteAccountData } from "@/lib/db/account";

// Same invariant as every other route that calls getAuth() (plan
// decision 20): createNeonAuth() validates its config synchronously and
// throws before cookies() is ever reached, so Next never auto-switches
// this route to dynamic on its own.
export const dynamic = "force-dynamic";

// The same taxonomy as /api/profile and /api/session, reused as-is: a
// transport/server failure is 503, an upstream 4xx is "no valid
// session", 401.
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

/**
 * Erases every row this app stores about the caller.
 *
 * Deliberately does NOT delete the auth account: that is Neon Auth's
 * record, and the client deletes it immediately after this returns, with
 * `authClient.deleteUser({ password })` — the only call that can verify
 * the password. Splitting it this way is what lets the destructive step
 * be gated on a password the app never sees.
 *
 * Takes no user identifier of any kind. The account erased is the one
 * the session cookie proves, and nothing else — a `userId` in the body
 * or the query string would be a way to erase someone else's data
 * (AGENTS.md, non-negotiable).
 */
export async function DELETE() {
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
      "[account] getAuth()/getSession() threw",
      thrown instanceof Error ? thrown.name : typeof thrown,
    );
    return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
  }

  if (error) {
    if (isTransportOrServerFailure(error)) {
      console.error(
        "[account] auth server reported a transport/server failure",
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

  try {
    await deleteAccountData(getDb(), data.user.id);
  } catch (thrown) {
    console.error(
      "[account] failed to delete the account data",
      thrown instanceof Error ? thrown.name : typeof thrown,
    );
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
