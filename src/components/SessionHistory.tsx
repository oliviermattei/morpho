import { getDb } from "@/lib/db";
import { listMeasurementSessions } from "@/lib/measurement-sessions";
import { getProfile } from "@/lib/profile";
import { SessionHistoryList } from "./SessionHistoryList";

/**
 * The one place on the read path that touches the database (plan task 6,
 * extended by task 9 for the IMC suffix) — deliberately its own module,
 * not an inline closure inside /historique's <Suspense>, so a test can
 * call it directly: `await SessionHistory({ userId })`, the same motif
 * src/app/page.test.tsx already uses for `await Home()`. A Server
 * Component wrapped in <Suspense> is never resolved by Testing Library's
 * render() (React doesn't await an async child on the client) — this
 * extraction is what makes it exercisable at all (task 8).
 */
export async function SessionHistory({ userId }: { userId: string }) {
  const db = getDb();
  const [sessions, profile] = await Promise.all([
    listMeasurementSessions(db, userId),
    getProfile(db, userId),
  ]);
  return (
    <SessionHistoryList
      sessions={sessions}
      heightCm={profile?.heightCm ?? null}
    />
  );
}
