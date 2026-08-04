"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { formatBmi } from "@/lib/bmi";
import { formatFullDate } from "@/lib/date";
import {
  MEASUREMENT_CATALOG,
  formatMeasurementValue,
  type MeasurementCatalogEntry,
  type MeasurementKind,
} from "@/lib/measurements";
import { routes } from "@/lib/routes";
import { formatTargetGap, isTargetReached, weightGapKg } from "@/lib/target-weight";
import { cn } from "@/lib/utils";
import type { BmiSeriesResult } from "@/lib/db/measurement-series";
import type { SeriesPoint } from "@/lib/measurement-series";
import { MeasurementChart } from "./MeasurementChart";

export interface MeasurementChartsPanelProps {
  seriesByKind: Record<MeasurementKind, SeriesPoint[]>;
  bmi: BmiSeriesResult;
  // s08 task 7: null when no target is set — the entire target row and
  // reference line disappear (criterion 4), and this component never
  // applies it outside the weight_kg selection (criterion 5), including
  // the IMC derived from it (decision 12).
  targetWeightKg: number | null;
}

type SelectionId = MeasurementKind | "bmi";

const BMI_ID = "bmi" as const;

interface PanelEntry {
  id: SelectionId;
  label: string;
  formatValue: (value: number) => string;
}

function toPanelEntry(catalogEntry: MeasurementCatalogEntry): PanelEntry {
  return {
    id: catalogEntry.kind,
    label: catalogEntry.label,
    formatValue: (value) => formatMeasurementValue(value, catalogEntry.unit),
  };
}

const BMI_ENTRY: PanelEntry = {
  id: BMI_ID,
  label: "IMC",
  formatValue: formatBmi,
};

// P13: labels, units and grouping are read from src/lib/measurements.ts
// (s03/s06's registry), never recopied — a corrected label there must
// change what this panel shows. IMC is the one entry added locally: it
// isn't a `kind`, so it can't live in MEASUREMENT_CATALOG.
//
// Weight is FIRST in this list, and that position is load-bearing: the
// carousel opens on index 0, so "le poids étant le principal à afficher
// en arrivant sur la page" follows from the catalog's own order (weight
// is the sole member of the "poids" group) rather than from a hard-coded
// start index that a reordered catalog would silently invalidate.
const WEIGHT_AND_INDICES_ENTRIES: PanelEntry[] = [
  ...MEASUREMENT_CATALOG.filter((entry) => entry.group === "poids").map(
    toPanelEntry,
  ),
  BMI_ENTRY,
  ...MEASUREMENT_CATALOG.filter((entry) => entry.group === "composition").map(
    toPanelEntry,
  ),
];

const MENSURATIONS_ENTRIES: PanelEntry[] = MEASUREMENT_CATALOG.filter(
  (entry) => entry.group === "mensurations",
).map(toPanelEntry);

// "Aucune mesure de poids", "Aucune mesure de cuisse", "Aucune mesure
// d'IMC": the partitive "de" needs no article for an ordinary noun, but
// still elides to "d'" before a vowel sound (IMC's own label is kept
// uppercase — it's an initialism, not a common noun to lowercase).
function partitiveDe(label: string): string {
  const lowered = label === "IMC" ? label : label.toLowerCase();
  return /^[aeiouyéèêAEIOUYÉÈÊ]/.test(lowered)
    ? `d'${lowered}`
    : `de ${lowered}`;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count > 1 ? plural : singular;
}

interface MeasureCardProps {
  entry: PanelEntry;
  series: SeriesPoint[];
  totalSessionCount: number;
  /** Non-null only for the weight card (criterion 5). */
  targetWeightKg: number | null;
  bmiHeightMissing?: boolean;
}

/**
 * One measure, one card — the unit both sections below are built from.
 *
 * This is the body the old <Select> used to swap in place. Extracting it
 * is what makes "one carousel slide" and "one row of the mensurations
 * list" the same thing: the two sections differ in how they LAY the
 * cards out, never in what a card shows.
 */
function MeasureCard({
  entry,
  series,
  totalSessionCount,
  targetWeightKg,
  bmiHeightMissing = false,
}: MeasureCardProps) {
  const lastPoint = series[series.length - 1];
  const gap =
    targetWeightKg !== null && lastPoint !== undefined
      ? weightGapKg(lastPoint.value, targetWeightKg)
      : null;

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-4">
        {/* Each card names its own measure. With the selector gone, this
            is the only thing identifying what a slide is showing. */}
        <h3 className="text-sm font-semibold text-foreground">{entry.label}</h3>

        {bmiHeightMissing ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Taille non renseignée</EmptyTitle>
              <EmptyDescription>
                L&apos;IMC se calcule à partir de votre taille.
                Renseignez-la une fois, elle s&apos;appliquera à tout
                l&apos;historique.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild className="h-11 w-full">
                <Link href={routes.profile}>Renseigner ma taille</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : series.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Aucune mesure {partitiveDe(entry.label)}</EmptyTitle>
              <EmptyDescription>
                Cette mesure n&apos;a jamais été saisie. Ajoutez-la à votre
                prochaine session pour voir la courbe apparaître.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild className="h-11 w-full">
                <Link href={routes.entry}>Saisir une session</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">
                Dernière valeur
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {entry.formatValue(lastPoint!.value)}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatFullDate(lastPoint!.t)}
              </span>
            </div>

            {/* s08 task 7: this row satisfies criterion 3 — the row
                chiffre, the graph shows. --font-sans + tabular-nums
                (s04 P2), never --font-mono. */}
            {targetWeightKg !== null && gap !== null && (
              <div className="flex flex-col gap-0.5 font-sans text-sm tabular-nums text-muted-foreground">
                <span>
                  Cible {formatMeasurementValue(targetWeightKg, "kg")} · écart{" "}
                  {formatTargetGap(gap)}
                </span>
                {isTargetReached(gap) && <span>Cible atteinte.</span>}
              </div>
            )}

            <MeasurementChart
              series={series}
              seriesLabel={entry.label}
              formatValue={entry.formatValue}
              targetWeightKg={targetWeightKg}
            />

            <p className="text-xs text-muted-foreground">
              {series.length === 1
                ? "Une seule mesure enregistrée : pas encore de tendance à lire."
                : series.length === totalSessionCount
                  ? `Seules les sessions où ${entry.label} a été saisi apparaissent — ${series.length} ${pluralize(series.length, "mesure", "mesures")}.`
                  : `Seules les sessions où ${entry.label} a été saisi apparaissent — ${series.length} ${pluralize(series.length, "mesure", "mesures")} sur ${totalSessionCount} ${pluralize(totalSessionCount, "session", "sessions")}.`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Plan s07 task 6, reworked: the <Select> that gated all ten measures
 * behind a single card is gone.
 *
 * Two sections now, because the two groups are read differently. Weight
 * and the indices derived from it are a small fixed set the user
 * compares against one another, so they sit in a looping carousel that
 * opens on the weight. The seven mensurations are a checklist to scan,
 * so they are all rendered, one under the other — no control to operate
 * before seeing them.
 *
 * The data still arrives whole from the page (R7 — one query at page
 * load); what changed is only how much of it is on screen at once.
 */
export function MeasurementChartsPanel({
  seriesByKind,
  bmi,
  targetWeightKg,
}: MeasurementChartsPanelProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!api) return;
    const sync = () => setSelectedIndex(api.selectedScrollSnap());
    sync();
    api.on("select", sync);
    return () => {
      api.off("select", sync);
    };
  }, [api]);

  // A session can never be written entirely empty (design system
  // §Formulaires) — so "at least one of the 10 kinds has a point" is
  // exactly "at least one session exists", with no second query.
  const hasAnySession = Object.values(seriesByKind).some(
    (series) => series.length > 0,
  );
  // M in "N mesures sur M sessions": every distinct session date across
  // all 10 kinds, derived from what's already loaded rather than a
  // second request (R7).
  const totalSessionCount = new Set(
    Object.values(seriesByKind).flatMap((series) =>
      series.map((point) => point.t),
    ),
  ).size;

  function seriesFor(id: SelectionId): SeriesPoint[] {
    if (id === BMI_ID) {
      return bmi.status === "ok" ? bmi.series : [];
    }
    return seriesByKind[id];
  }

  // Kept whole rather than repeated per card: "no session at all" is one
  // fact about the account, and ten cards each saying it would be ten
  // copies of the same invitation.
  if (!hasAnySession) {
    return (
      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Aucune session enregistrée</EmptyTitle>
              <EmptyDescription>
                Les courbes apparaîtront dès votre première session de
                mesures.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild className="h-11 w-full">
                <Link href={routes.entry}>Saisir ma première session</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  const currentEntry = WEIGHT_AND_INDICES_ENTRIES[selectedIndex];

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Poids et indices" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Poids et indices
          </h2>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Mesure précédente"
              onClick={() => api?.scrollPrev()}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Mesure suivante"
              onClick={() => api?.scrollNext()}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* `loop: true` is the "carousel infini": past the last index the
            next swipe returns to the weight instead of hitting a wall.
            No startIndex is passed — index 0 already IS the weight (see
            WEIGHT_AND_INDICES_ENTRIES above). */}
        <Carousel opts={{ loop: true, align: "start" }} setApi={setApi}>
          <CarouselContent>
            {WEIGHT_AND_INDICES_ENTRIES.map((entry) => (
              <CarouselItem key={entry.id}>
                <MeasureCard
                  entry={entry}
                  series={seriesFor(entry.id)}
                  totalSessionCount={totalSessionCount}
                  // Criterion 5: the target never applies outside the
                  // weight card — not even to the IMC derived FROM the
                  // weight series (decision 12).
                  targetWeightKg={
                    entry.id === "weight_kg" ? targetWeightKg : null
                  }
                  bmiHeightMissing={
                    entry.id === BMI_ID && bmi.status === "heightMissing"
                  }
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Position indicator, and a control in its own right. On a
            looping carousel there is no edge to feel, so this is the only
            thing saying where the user is and how many measures they
            haven't reached yet. */}
        <div className="flex items-center justify-center gap-2">
          {WEIGHT_AND_INDICES_ENTRIES.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              aria-label={entry.label}
              aria-current={index === selectedIndex ? "true" : undefined}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === selectedIndex
                  ? "w-6 bg-foreground"
                  : "w-1.5 bg-muted-foreground/40",
              )}
              onClick={() => api?.scrollTo(index)}
            />
          ))}
        </div>
        {/* Swiping is a silent change for a screen reader otherwise. */}
        {currentEntry && (
          <p aria-live="polite" className="sr-only">
            {currentEntry.label}
          </p>
        )}
      </section>

      <section aria-label="Mensurations" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Mensurations
        </h2>
        <div className="flex flex-col gap-4">
          {MENSURATIONS_ENTRIES.map((entry) => (
            <MeasureCard
              key={entry.id}
              entry={entry}
              series={seriesFor(entry.id)}
              totalSessionCount={totalSessionCount}
              targetWeightKg={null}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
