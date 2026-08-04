import { eq, inArray } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { AppDatabase } from "./index";
import { measurementSessions, measurements, profiles } from "./schema";

/**
 * Everything this app stores about one user, in the order the foreign
 * keys allow it to be removed.
 *
 * Both `measurement_sessions.user_id` and `profiles.user_id` already
 * declare `onDelete: "cascade"` toward `neon_auth."user"`, so deleting
 * the auth account would take these rows with it. This does not lean on
 * that, for the same reason buildDeleteSessionStatements doesn't lean on
 * its own cascade (s09 R7): the promise made to the user is "suppression
 * définitive", and a promise that depends on a cascade firing in a
 * schema this project explicitly does not own (ADR 003 — `neon_auth`
 * belongs to Neon Auth) is a promise with a dependency the app cannot
 * test. If the cascade works, these statements are inert. If Neon Auth
 * ever soft-deletes instead, they are what actually removes the data.
 *
 * Scoped to `userId` on every statement, never a bare `.delete(table)` —
 * the same rule the session deletion follows.
 */
export function buildDeleteAccountStatements(db: AppDatabase, userId: string) {
  const ownedSessionIds = db
    .select({ id: measurementSessions.id })
    .from(measurementSessions)
    .where(eq(measurementSessions.userId, userId));

  // ① the measurements, before their sessions — a session deleted first
  // would make this subquery resolve to nothing and orphan the rows.
  const deleteMeasurements = db
    .delete(measurements)
    .where(inArray(measurements.sessionId, ownedSessionIds));

  const deleteSessions = db
    .delete(measurementSessions)
    .where(eq(measurementSessions.userId, userId));

  const deleteProfile = db.delete(profiles).where(eq(profiles.userId, userId));

  return { deleteMeasurements, deleteSessions, deleteProfile };
}

/**
 * Executor: same driver requirement as the session helpers — batch()
 * only exists on NeonHttpDatabase, and the three deletions must land as
 * one transaction. A partial deletion is the one outcome worse than
 * either extreme: it would leave measurements pointing at a profile that
 * no longer exists, with nothing on screen to reveal it.
 */
export async function deleteAccountData(
  db: NeonHttpDatabase,
  userId: string,
): Promise<void> {
  const { deleteMeasurements, deleteSessions, deleteProfile } =
    buildDeleteAccountStatements(db, userId);

  await db.batch([deleteMeasurements, deleteSessions, deleteProfile]);
}
