import type { AppDatabase } from "@/lib/db";
import { getDb } from "@/lib/db";
import { getLatestValueByKind } from "@/lib/db/latest-measurements";
import type { MeasurementKind } from "@/lib/measurements";
import { MeasurementSessionForm } from "./MeasurementSessionForm";

type PrefillResult =
  | { status: "ok"; values: Partial<Record<MeasurementKind, number>> }
  | { status: "error" };

/**
 * Plan task 8, decision N9: the read that feeds the prefill is a comfort,
 * not the page's reason to exist — no error boundary is planned on
 * /saisie, so an unwrapped throw here would take the whole Suspense
 * boundary down with it and erase the form the user came to fill in.
 * Wrapped here so the failure never escapes as a thrown exception, only
 * as a discriminated result the caller renders around.
 */
async function readInitialValues(
  db: AppDatabase,
  userId: string,
): Promise<PrefillResult> {
  try {
    const values = await getLatestValueByKind(db, userId);
    return { status: "ok", values };
  } catch (thrown) {
    console.error(
      "[saisie] failed to read the last known measurement values",
      thrown instanceof Error ? thrown.name : typeof thrown,
    );
    return { status: "error" };
  }
}

/**
 * The one place on /saisie's read path that touches the database (plan
 * task 3) — deliberately its own module, not an inline closure inside a
 * <Suspense>, so a test can call it directly:
 * `await MeasurementSessionFormLoader({ userId })`, the same motif
 * src/components/SessionHistory.tsx and ProfileContent.tsx already
 * establish. getDb() is called inside this function, never at module
 * scope (s01 review, finding D). `userId` is passed in server-to-server
 * by the page that already read the session — never a client input.
 */
export async function MeasurementSessionFormLoader({
  userId,
}: {
  userId: string;
}) {
  const db = getDb();
  const result = await readInitialValues(db, userId);
  if (result.status === "error") {
    return <MeasurementSessionForm mode="create" suggestions={{}} prefillFailed />;
  }
  return <MeasurementSessionForm mode="create" suggestions={result.values} />;
}
