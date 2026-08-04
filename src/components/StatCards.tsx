import type { BodyMapView, ViewEntry } from "@/lib/body-map-view";
import { MEASUREMENT_CATALOG_BY_KIND } from "@/lib/measurements";
import { thirdLine } from "@/lib/measurement-display";

const NONE_ENTRY: ViewEntry = {
  state: "none",
  valueText: null,
  deltaText: null,
  verdict: null,
};

/**
 * ADR 020: the 2×2 grid under the silhouette — Poids, IMC, Masse
 * grasse, Masse musculaire, the four measures that have no body zone to
 * point at.
 *
 * Replaces OffBodyCards.tsx, which rendered the same four values as
 * plain cards. Two things changed and both come from the design: the
 * value is set large, and the delta is a tinted pill rather than a line
 * of coloured text.
 *
 * The IMC no longer has a "no height set" branch. It cannot happen any
 * more: the onboarding makes the height mandatory before the home
 * screen is reachable at all (src/lib/onboarding-gate.ts), so the
 * fallback that used to send the user to /profil would be dead code
 * dressed as a safety net.
 */

function DeltaPill({ entry }: { entry: ViewEntry }) {
  // Not compared = nothing to tint. "Aucune mesure" / "1 mesure" are
  // states, not progress, and a green pill around them would read as an
  // achievement (thirdLine already returns exactly this wording — one
  // definition, shared with the silhouette's own labels).
  if (entry.state !== "compared" || entry.verdict === null) {
    return (
      <p className="mt-1.5 text-label-min text-muted-foreground">
        {thirdLine(entry)}
      </p>
    );
  }

  const tint =
    entry.verdict === "favorable"
      ? "bg-progress-favorable/10 text-progress-favorable"
      : entry.verdict === "adverse"
        ? "bg-progress-adverse/10 text-progress-adverse"
        : "bg-muted text-muted-foreground";

  return (
    <p
      data-delta-pill
      className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-label-min font-semibold tabular-nums ${tint}`}
    >
      {entry.deltaText}
    </p>
  );
}

function StatCard({ label, entry }: { label: string; entry: ViewEntry }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3">
      <p className="text-label-min text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums">
        {entry.valueText ?? "—"}
      </p>
      <DeltaPill entry={entry} />
    </div>
  );
}

export function StatCards({ view }: { view: BodyMapView }) {
  return (
    <section
      aria-label="Mesures sans zone corporelle"
      className="grid grid-cols-2 gap-2.5"
    >
      <StatCard
        label={MEASUREMENT_CATALOG_BY_KIND.weight_kg.label}
        entry={view.measurements.weight_kg ?? NONE_ENTRY}
      />
      <StatCard label="IMC" entry={view.bmi} />
      <StatCard
        label={MEASUREMENT_CATALOG_BY_KIND.body_fat_pct.label}
        entry={view.measurements.body_fat_pct ?? NONE_ENTRY}
      />
      <StatCard
        label={MEASUREMENT_CATALOG_BY_KIND.muscle_pct.label}
        entry={view.measurements.muscle_pct ?? NONE_ENTRY}
      />
    </section>
  );
}
