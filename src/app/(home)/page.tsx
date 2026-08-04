import Link from "next/link";
import { getBodyMapData } from "@/lib/db/body-map";
import { buildBodyMapView } from "@/lib/body-map-view";
import { deriveTransformationPhase } from "@/lib/home-summary";
import { daysSince } from "@/lib/onboarding";
import { requireOnboarded } from "@/lib/onboarding-gate";
import { routes } from "@/lib/routes";
import { BodySilhouette } from "@/components/BodySilhouette";
import { BottomNav } from "@/components/BottomNav";
import { HomeHeader } from "@/components/HomeHeader";
import { StatCards } from "@/components/StatCards";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

// Every page/route that calls getAuth() needs this (plan decision 20 of
// s03, reused here) — createNeonAuth() validates its config synchronously
// and throws before cookies() is ever reached, so Next never
// auto-switches this route to dynamic on its own. requireOnboarded()
// calls getAuth() on this page's behalf; the requirement is unchanged.
export const dynamic = "force-dynamic";

/**
 * The home screen, redesigned (ADR 020).
 *
 * Order, unchanged in principle from s06's decision 17: (1) session and
 * onboarding, both of which may redirect — and both now inside
 * requireOnboarded(), which keeps its redirect() calls OUTSIDE any try
 * (redirect throws NEXT_REDIRECT; catching it would turn a redirect into
 * this page's error state); (2) read the body data, inside a try — a
 * read failure here is this page's own error state; (3) render.
 *
 * `userId` still comes from the verified session and nowhere else — this
 * component declares no props at all.
 */
export default async function Home() {
  const { userId, profile } = await requireOnboarded();

  let bodyMapData: Awaited<ReturnType<typeof getBodyMapData>>;
  try {
    // The height comes from the profile the gate already read — no
    // second query for a value we are holding (src/lib/db/body-map.ts).
    bodyMapData = await getBodyMapData(userId, profile.heightCm);
  } catch (thrown) {
    console.error(
      "[accueil] failed to read body map data",
      thrown instanceof Error ? thrown.name : typeof thrown,
    );
    return (
      <>
        <HomeHeader
          days={daysSince(profile.transformationStartedOn)}
          phase="no-measurement"
        />
        <main className="flex flex-1 flex-col gap-6 px-4 py-6 pb-28">
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>Impossible de charger vos mesures</EmptyTitle>
              <EmptyDescription>
                Vérifiez votre connexion, puis réessayez. Vos données sont
                intactes.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {/* Plan decision 15 (s06): a bare anchor, not <Link> — a
                  full reload is exactly what a network-failure retry
                  needs, and only a real navigation re-runs a Server
                  Component that already rendered its error state. */}
              <Button asChild className="h-11 w-full" variant="outline">
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- deliberate full reload, see comment above */}
                <a href="/">Réessayer</a>
              </Button>
            </EmptyContent>
          </Empty>
        </main>
        <BottomNav />
      </>
    );
  }

  const view = buildBodyMapView(
    bodyMapData.first,
    bodyMapData.last,
    bodyMapData.heightCm,
  );
  const phase = deriveTransformationPhase(
    bodyMapData.first.weight_kg,
    bodyMapData.last.weight_kg,
  );
  // Criterion 9 (s06): "no session" means no measurement session ever
  // recorded — distinct from the auth session. `last` is empty exactly
  // when this user has never recorded a single kind.
  const hasNoMeasurementSessionEver = Object.keys(bodyMapData.last).length === 0;

  return (
    <>
      <HomeHeader
        days={daysSince(profile.transformationStartedOn)}
        phase={phase}
      />
      {/* pb-28 clears the fixed BottomNav — without it the last card
          sits permanently under the bar and can never be scrolled into
          view. */}
      <main className="flex flex-1 flex-col gap-3 px-4 pb-28">
        <BodySilhouette view={view} sex={profile.sex} />
        <StatCards view={view} />

        {hasNoMeasurementSessionEver && (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>Aucune mesure enregistrée</EmptyTitle>
              <EmptyDescription>
                Votre silhouette s&apos;annotera dès la première session.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild className="h-11 w-full">
                <Link href={routes.entry}>Saisir ma première mesure</Link>
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </main>
      <BottomNav />
    </>
  );
}
