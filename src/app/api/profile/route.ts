import { NextResponse } from "next/server";
import { NEON_AUTH_NETWORK_ERROR_CODES } from "@neondatabase/auth/next/server";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HEIGHT_FORMAT_ERROR, heightInputSchema } from "@/lib/height";
import { saveHeight, saveIdentity, saveTargetWeight } from "@/lib/profile";
import type { ProfileSex } from "@/lib/profile";
import {
  TARGET_WEIGHT_FORMAT_ERROR,
  targetWeightInputSchema,
} from "@/lib/target-weight";
import {
  SEX_FORMAT_ERROR,
  START_DATE_FORMAT_ERROR,
  makeStartDateSchema,
  sexInputSchema,
} from "@/lib/onboarding";

// Plan decision 20 (s01/s02/s03 precedent) — createNeonAuth() validates
// its config synchronously and throws before the SDK ever reaches
// cookies(), so Next never auto-switches this route to dynamic on its
// own. Without this, `next build` fails on a machine with no secrets.
export const dynamic = "force-dynamic";

// P6: the same taxonomy as src/app/api/session/route.ts and
// src/app/api/sessions/route.ts, reused as-is rather than rewritten — a
// genuine transport/server failure is 503; an upstream 4xx (expired or
// forged token) is "no valid session", 401.
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

// No GET /api/profile (plan task 7, s03 decision 8): the read path is the
// /profil Server Component (task 8), not this route.
export async function PUT(request: Request) {
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
      "[profile] getAuth()/getSession() threw",
      thrown instanceof Error ? thrown.name : typeof thrown,
    );
    return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
  }

  if (error) {
    if (isTransportOrServerFailure(error)) {
      console.error(
        "[profile] auth server reported a transport/server failure",
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
  // request body, the query string or a header (AGENTS.md, non-negotiable
  // — a forged user_id anywhere on the request is never read).
  const userId = data.user.id;

  // Review finding 2 (s04) / trap 11 (s08): absent is not empty. An
  // unparseable body, a missing field, or a wrong-typed one (e.g. a
  // JSON number) are all refused with 400 here, before either schema
  // below is ever reached — collapsing any of them into "" would
  // trigger the R7 erase signal and silently wipe a stored value on a
  // request the story considers invalid. Only an explicit string
  // (including "" itself) is allowed to reach a schema.
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        fieldErrors: {
          heightCm: [HEIGHT_FORMAT_ERROR],
          targetWeightKg: [TARGET_WEIGHT_FORMAT_ERROR],
        },
      },
      { status: 400 },
    );
  }

  const record =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;

  // Both fields are validated before anything is written — s08 task 5's
  // form submits them together (one FieldSet each, one button), so a
  // response reporting only the first invalid field would leave the
  // second error undiscovered until a second round trip.
  const fieldErrors: Record<string, string[]> = {};
  let heightCm: number | null | undefined;
  let targetWeightKg: number | null | undefined;

  const rawHeightCm = record?.heightCm;
  if (typeof rawHeightCm !== "string") {
    fieldErrors.heightCm = [HEIGHT_FORMAT_ERROR];
  } else {
    const parsedHeight = heightInputSchema.safeParse(rawHeightCm);
    if (!parsedHeight.success) {
      fieldErrors.heightCm = parsedHeight.error.issues.map(
        (issue) => issue.message,
      );
    } else {
      heightCm = parsedHeight.data;
    }
  }

  const rawTargetWeightKg = record?.targetWeightKg;
  if (typeof rawTargetWeightKg !== "string") {
    fieldErrors.targetWeightKg = [TARGET_WEIGHT_FORMAT_ERROR];
  } else {
    const parsedTarget = targetWeightInputSchema.safeParse(rawTargetWeightKg);
    if (!parsedTarget.success) {
      fieldErrors.targetWeightKg = parsedTarget.error.issues.map(
        (issue) => issue.message,
      );
    } else {
      targetWeightKg = parsedTarget.data;
    }
  }

  // ADR 020: the two onboarding fields are OPTIONAL on this endpoint,
  // and optional together. The onboarding screen and /profil both send
  // them; every caller written before the redesign sends neither, and
  // must keep working unchanged — which is why their absence is not an
  // error here, unlike heightCm and targetWeightKg above.
  //
  // "Together" is the real constraint: sex and start date are what the
  // gate checks, so accepting one without the other would write a
  // profile that still fails the gate, with no field left on screen to
  // explain why. Sending one alone is a 400 on the missing one.
  let sex: ProfileSex | undefined;
  let transformationStartedOn: string | undefined;

  const rawSex = record?.sex;
  const rawStartedOn = record?.transformationStartedOn;

  if (rawSex !== undefined || rawStartedOn !== undefined) {
    if (typeof rawSex !== "string") {
      fieldErrors.sex = [SEX_FORMAT_ERROR];
    } else {
      const parsedSex = sexInputSchema.safeParse(rawSex);
      if (!parsedSex.success) {
        fieldErrors.sex = [SEX_FORMAT_ERROR];
      } else {
        sex = parsedSex.data;
      }
    }

    if (typeof rawStartedOn !== "string") {
      fieldErrors.transformationStartedOn = [START_DATE_FORMAT_ERROR];
    } else {
      // Built per request, not at module scope: the schema closes over
      // "today" to refuse a future date, and a module-scope instance
      // would freeze that day at process start — a server up for a week
      // would start accepting dates it should refuse.
      const parsedStartedOn = makeStartDateSchema().safeParse(rawStartedOn);
      if (!parsedStartedOn.success) {
        fieldErrors.transformationStartedOn = parsedStartedOn.error.issues.map(
          (issue) => issue.message,
        );
      } else {
        transformationStartedOn = parsedStartedOn.data;
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ fieldErrors }, { status: 400 });
  }

  try {
    const db = getDb();
    // Two independent upserts, both scoped to userId's own row: neither
    // clobbers the other's column (src/lib/profile.ts's onConflictDoUpdate
    // `set` shape). No second endpoint, no cross-screen cache invalidation
    // call added here (decision 10).
    await saveHeight(db, userId, heightCm as number | null);
    await saveTargetWeight(db, userId, targetWeightKg as number | null);
    if (sex !== undefined && transformationStartedOn !== undefined) {
      await saveIdentity(db, userId, sex, transformationStartedOn);
    }
  } catch (thrown) {
    console.error(
      "[profile] failed to persist the profile",
      thrown instanceof Error ? thrown.name : typeof thrown,
    );
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }

  return NextResponse.json(
    { heightCm, targetWeightKg, sex, transformationStartedOn },
    { status: 200 },
  );
}
