import { OfflineBanner } from "./OfflineBanner";

/**
 * The header every screen other than the home one carries.
 *
 * Until now only the home screen had a header: the other five opened on
 * a bare `‹ Retour` link, which was both a second way to do what
 * BottomNav already does permanently (ADR 020 mounted it everywhere) and
 * the only thing identifying the app at the top of the page. Those links
 * are gone and this takes their place, so the brand mark and the offline
 * banner sit in the same position on every screen.
 *
 * Deliberately not the same component as HomeHeader: that one carries
 * the day counter and the transformation phase, which are facts about
 * the home screen's subject, not chrome. What the two share — the brand
 * mark's typography and the OfflineBanner directly under it — is
 * shared by reproducing three attributes, not by adding a props union to
 * make one component serve both.
 */
export function PageHeader({ title }: { title: string }) {
  return (
    <>
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2.5">
        <span className="text-xl font-bold tracking-tight text-foreground">
          morpho
        </span>
        <span className="text-xs text-muted-foreground">{title}</span>
      </header>
      <OfflineBanner />
    </>
  );
}
