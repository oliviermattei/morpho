import Link from "next/link";
import { redirect } from "next/navigation";
import { NEON_AUTH_NETWORK_ERROR_CODES } from "@neondatabase/auth/next/server";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getAllMeasurementSeries } from "@/lib/db/measurement-series";
import { getProfile, type Profile } from "@/lib/profile";
import { isOnboarded } from "@/lib/onboarding";
import { routes } from "@/lib/routes";
import { MeasurementChartsPanel } from "@/components/MeasurementChartsPanel";
import { RetryButton } from "@/components/RetryButton";
import { BottomNav } from "@/components/BottomNav";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

// Plan decision 20 (s01/s02/s03 precedent, reproduced by every page that
// calls getAuth()): createNeonAuth() validates its config synchronously
// and throws before cookies() is ever reached, so Next never
// auto-switches this route to dynamic on its own.
export const dynamic = "force-dynamic";

// P14, same taxonomy as src/app/api/session/route.ts and
// src/app/api/profile/route.ts, reused as-is: a genuine transport/server
// failure must never read as "no valid session" — that would redirect a
// connected user to a sign-in screen that fails for the same reason.
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

function ReadErrorState() {
  return (
    <Empty className="border" role="alert">
      <EmptyHeader>
        <EmptyTitle>Impossible de charger la courbe</EmptyTitle>
        <EmptyDescription>
          Les données n&apos;ont pas pu être récupérées. Vérifiez votre
          connexion, puis réessayez.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <RetryButton />
      </EmptyContent>
    </Empty>
  );
}

function GraphesShell({ children }: { children: React.ReactNode }) {
  return (
    <>
    <main className="flex flex-1 flex-col gap-6 px-4 py-6 pb-28">
      {/* "/" is the home screen (src/app/(home)/page.tsx) — not one of
          routes.ts's named entries, same as that page's own retry link
          (src/app/(home)/page.tsx: `<a href="/">`). routes.ts's scan
          only guards its four named routes, not this one, by the same
          existing convention. */}
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground"
      >
        ‹ Accueil
      </Link>
      <h1 className="text-lg font-semibold text-foreground">Évolution</h1>
      {children}
    </main>
    {/* ADR 020: the same bar as every other screen. Outside <main> so
        the fixed bar is never a child of the scrolling column. */}
    <BottomNav />
    </>
  );
}

/**
 * Server Component (plan task 7). Declares no props at all — no query
 * string, no route param — so identity comes exclusively from
 * `getAuth().getSession()`, and the selected measure is
 * MeasurementChartsPanel's own local state (R6): nothing client-controlled
 * on the request can ever influence which user's data this reads (test
 * of forgery).
 *
 * The `{ data, error }` envelope is handled exactly like
 * src/app/api/session/route.ts (P14): no session -> redirect; a
 * transport/server failure, or getAuth() throwing synchronously -> the
 * read-error state, never the sign-in redirect (an anonymous-looking
 * error during an outage must not send a connected user through a
 * magic-link flow that would fail for the same reason).
 */
export default async function GraphesPage() {
  let data: Awaited<ReturnType<ReturnType<typeof getAuth>["getSession"]>>["data"];
  let error: Awaited<ReturnType<ReturnType<typeof getAuth>["getSession"]>>["error"];

  try {
    ({ data, error } = await getAuth().getSession());
  } catch (thrown) {
    console.error(
      "[graphes] getAuth()/getSession() threw",
      thrown instanceof Error ? thrown.name : typeof thrown,
    );
    return (
      <GraphesShell>
        <ReadErrorState />
      </GraphesShell>
    );
  }

  if (error) {
    if (isTransportOrServerFailure(error)) {
      console.error(
        "[graphes] auth server reported a transport/server failure",
        error.status,
        error.code,
      );
      return (
        <GraphesShell>
          <ReadErrorState />
        </GraphesShell>
      );
    }
    redirect(routes.signIn);
  }

  if (!data?.user) {
    redirect(routes.signIn);
  }

  // The success JSX is built AFTER this try/catch resolves, never inside
  // it: React defers rendering a constructed element, so a render-time
  // error inside <MeasurementChartsPanel> would never actually reach
  // this catch (react-hooks/error-boundaries) — only the reads are
  // guarded here.
  //
  // s08 task 7: the target weight comes off the same profiles row s04
  // already reads (getProfile) — one more field on an existing read, not
  // a second query module. Fetched alongside the series (Promise.all):
  // a failure on either one is the same "data layer failed" state, never
  // a half-rendered chart with a silently missing target.
  let series: Awaited<ReturnType<typeof getAllMeasurementSeries>> | null = null;
  let targetWeightKg: number | null = null;
  // ADR 020: read here, acted on AFTER the try. redirect() signals by
  // throwing NEXT_REDIRECT, so calling it inside this catch-all try
  // would turn "finish your onboarding" into the read-error state.
  let profileRow: Profile | null = null;
  try {
    const db = getDb();
    const [seriesResult, profile] = await Promise.all([
      getAllMeasurementSeries(db, data.user.id),
      getProfile(db, data.user.id),
    ]);
    series = seriesResult;
    profileRow = profile;
    targetWeightKg = profile?.targetWeightKg ?? null;
  } catch (thrown) {
    console.error(
      "[graphes] failed to read the measurement series or the profile",
      thrown instanceof Error ? thrown.name : typeof thrown,
    );
  }

  if (series === null) {
    return (
      <GraphesShell>
        <ReadErrorState />
      </GraphesShell>
    );
  }

  // Only once the read succeeded: an incomplete profile is a real state
  // to fix, a failed read is not evidence of one.
  if (!isOnboarded(profileRow)) {
    redirect(routes.onboarding);
  }

  return (
    <GraphesShell>
      <MeasurementChartsPanel
        seriesByKind={series.byKind}
        bmi={series.bmi}
        targetWeightKg={targetWeightKg}
      />
    </GraphesShell>
  );
}
