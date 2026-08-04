import { NextResponse } from "next/server";
import { z } from "zod";
import { NEON_AUTH_NETWORK_ERROR_CODES } from "@neondatabase/auth/next/server";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  deleteSessionForUser,
  getSessionForUser,
  updateSessionForUser,
} from "@/lib/db/sessions";
import {
  MIN_MEASURED_ON,
  maxAllowedMeasuredOn,
} from "@/lib/measurement-session-input";
import {
  MEASUREMENT_CATALOG,
  MEASUREMENT_VALUE_INVALID_MESSAGE,
  buildDesiredMeasurements,
  sessionIdSchema,
  type MeasurementKind,
} from "@/lib/measurements";

// Every route handler calling getAuth() needs this (plan decision 20,
// s01/s02/s03 precedent) — createNeonAuth() validates its config
// synchronously and throws before cookies() is ever reached.
export const dynamic = "force-dynamic";

// Same taxonomy as src/app/api/session/route.ts and src/app/api/sessions/
// route.ts (plan task 6: "réutiliser la taxonomie").
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

// R5, corrected: the message names the actual way out — deleting the
// session — rather than repeating POST /api/sessions' creation-time
// wording ("Renseignez au moins une mesure avant d'enregistrer.").
const EMPTY_SESSION_MESSAGE =
  "Une session doit contenir au moins une mesure. Pour tout retirer, supprimez la session.";

// Mirrors src/lib/measurement-session-input.ts's own date schema (s03) —
// kept local rather than imported: that module has no exported date
// schema, only MIN_MEASURED_ON/maxAllowedMeasuredOn (reused below), and
// this route's Files touched never lists measurement-session-input.ts as
// modified.
const dateSchema = z.iso.date({ error: "La date n'est pas reconnue." });

type IdentityResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 503 };

async function resolveIdentity(): Promise<IdentityResult> {
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
      "[sessions/:id] getAuth()/getSession() threw",
      thrown instanceof Error ? thrown.name : typeof thrown,
    );
    return { ok: false, status: 503 };
  }

  if (error) {
    if (isTransportOrServerFailure(error)) {
      console.error(
        "[sessions/:id] auth server reported a transport/server failure",
        error.status,
        error.code,
      );
      return { ok: false, status: 503 };
    }
    return { ok: false, status: 401 };
  }

  if (!data?.user) {
    return { ok: false, status: 401 };
  }

  // Identity always comes from the verified session, never the request
  // (AGENTS.md, non-negotiable).
  return { ok: true, userId: data.user.id };
}

function identityFailureResponse(status: 401 | 503) {
  return NextResponse.json(
    { error: status === 503 ? "auth_unavailable" : "unauthorized" },
    { status },
  );
}

// P4: a malformed or nonexistent segment both resolve to the generic 404
// taxonomy below — never an exception, never a 500, never a database call.
async function resolveSessionId(
  params: Promise<{ id: string }>,
): Promise<string | null> {
  const { id } = await params;
  const parsed = sessionIdSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

interface PatchValidationResult {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
  measuredOn?: string;
  values: Partial<Record<MeasurementKind, number>>;
}

/**
 * R2/R13: no second parser. Date validation mirrors s03's own window
 * (MIN_MEASURED_ON/maxAllowedMeasuredOn, imported, never redeclared);
 * every measurement field's classification and range check is
 * buildDesiredMeasurements' job (task 2) — this function only adds the
 * one case buildDesiredMeasurements never sees, a raw JSON value that
 * isn't even a string, and R5's "at least one field was addressed" rule,
 * which is a payload-level concern, not a per-field one.
 */
function validatePatchPayload(
  payload: unknown,
  now: Date,
): PatchValidationResult {
  const record =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};

  const fieldErrors: Record<string, string[]> = {};
  const formErrors: string[] = [];

  let measuredOn: string | undefined;
  const dateResult = dateSchema.safeParse(record.measuredOn);
  if (!dateResult.success) {
    fieldErrors.measuredOn = ["La date n'est pas reconnue."];
  } else if (
    dateResult.data < MIN_MEASURED_ON ||
    dateResult.data > maxAllowedMeasuredOn(now)
  ) {
    fieldErrors.measuredOn = ["Cette date n'est pas valide."];
  } else {
    measuredOn = dateResult.data;
  }

  const rawFields: Partial<Record<MeasurementKind, string>> = {};
  let hasAnyNonEmptyField = false;

  for (const entry of MEASUREMENT_CATALOG) {
    const raw = record[entry.kind];
    if (raw === undefined || raw === null) continue;

    if (typeof raw !== "string") {
      hasAnyNonEmptyField = true;
      fieldErrors[entry.kind] = [MEASUREMENT_VALUE_INVALID_MESSAGE];
      continue;
    }

    if (raw.trim() !== "") {
      hasAnyNonEmptyField = true;
    }
    rawFields[entry.kind] = raw;
  }

  const { values, fieldErrors: measurementFieldErrors } =
    buildDesiredMeasurements(rawFields);
  for (const [kind, message] of Object.entries(measurementFieldErrors)) {
    fieldErrors[kind] = [message];
  }

  // R5: a session must keep at least one measurement — refused before
  // any write, with the message naming the actual way out.
  if (!hasAnyNonEmptyField) {
    formErrors.push(EMPTY_SESSION_MESSAGE);
  }

  return { fieldErrors, formErrors, measuredOn, values };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const identity = await resolveIdentity();
  if (!identity.ok) {
    return identityFailureResponse(identity.status);
  }

  const sessionId = await resolveSessionId(params);
  if (sessionId === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = undefined;
  }

  const { fieldErrors, formErrors, measuredOn, values } = validatePatchPayload(
    payload,
    new Date(),
  );

  if (
    Object.keys(fieldErrors).length > 0 ||
    formErrors.length > 0 ||
    measuredOn === undefined
  ) {
    return NextResponse.json({ fieldErrors, formErrors }, { status: 400 });
  }

  try {
    const db = getDb();

    // P2: a read guard before any write — buildUpdateSessionStatements'
    // insert (task 4, instruction ③) carries no property scope of its
    // own, since an INSERT cannot. R6: an access-cross session resolves
    // to the same 404 as one that doesn't exist, never a distinct
    // "not yours" message.
    const existing = await getSessionForUser(db, {
      sessionId,
      userId: identity.userId,
    });
    if (!existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const result = await updateSessionForUser(db, {
      sessionId,
      userId: identity.userId,
      measuredOn,
      values,
    });
    if (!result.found) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  } catch (thrown) {
    console.error(
      "[sessions/:id] PATCH failed to persist",
      thrown instanceof Error ? thrown.name : typeof thrown,
    );
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }

  // R10: no server cache revalidation call here — every affected screen
  // is force-dynamic and staleTimes.dynamic is 0, so a client-side
  // navigation always refetches on its own.
  return NextResponse.json({ id: sessionId }, { status: 200 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const identity = await resolveIdentity();
  if (!identity.ok) {
    return identityFailureResponse(identity.status);
  }

  const sessionId = await resolveSessionId(params);
  if (sessionId === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const db = getDb();

    const existing = await getSessionForUser(db, {
      sessionId,
      userId: identity.userId,
    });
    if (!existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const result = await deleteSessionForUser(db, {
      sessionId,
      userId: identity.userId,
    });
    if (!result.found) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  } catch (thrown) {
    console.error(
      "[sessions/:id] DELETE failed",
      thrown instanceof Error ? thrown.name : typeof thrown,
    );
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }

  return new NextResponse(null, { status: 204 });
}
