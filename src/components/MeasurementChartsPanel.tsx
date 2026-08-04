"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
const DEFAULT_SELECTION: SelectionId = "weight_kg";

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
// change what this selector shows. IMC is the one entry added locally
// (design's "Reused components", select row): it isn't a `kind`, so it
// can't live in MEASUREMENT_CATALOG.
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

const ENTRIES_BY_ID = new Map<SelectionId, PanelEntry>(
  [...WEIGHT_AND_INDICES_ENTRIES, ...MENSURATIONS_ENTRIES].map((entry) => [
    entry.id,
    entry,
  ]),
);

function requiredEntry(id: SelectionId): PanelEntry {
  const entry = ENTRIES_BY_ID.get(id);
  if (!entry) {
    throw new Error(`Unreachable: ${id} missing from the panel's entries`);
  }
  return entry;
}

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

/**
 * Plan s07 task 6: the selector + the one card whose content the
 * selected measure entirely determines — chart, one of three distinct
 * empty states. The loading state and the read-failure error state
 * live one level up (src/app/graphes/page.tsx, src/app/graphes/
 * loading.tsx): by the time this component mounts, the data is already
 * there (R7 — one query at page load, R6 — selection is local state).
 */
export function MeasurementChartsPanel({
  seriesByKind,
  bmi,
  targetWeightKg,
}: MeasurementChartsPanelProps) {
  const [selectedId, setSelectedId] = useState<SelectionId>(DEFAULT_SELECTION);

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

  const entry = requiredEntry(selectedId);
  const isBmiHeightMissing = selectedId === BMI_ID && bmi.status === "heightMissing";
  const series: SeriesPoint[] =
    selectedId === BMI_ID
      ? bmi.status === "ok"
        ? bmi.series
        : []
      : seriesByKind[selectedId];

  // Criterion 5: the target never applies outside the weight selection —
  // not even to the IMC derived FROM the weight series (decision 12).
  const effectiveTargetWeightKg =
    selectedId === "weight_kg" ? targetWeightKg : null;
  const lastPoint = series[series.length - 1];
  const gap =
    effectiveTargetWeightKg !== null && lastPoint !== undefined
      ? weightGapKg(lastPoint.value, effectiveTargetWeightKg)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="measurement-select">Mesure</Label>
        <Select
          value={selectedId}
          onValueChange={(value) => setSelectedId(value as SelectionId)}
          disabled={!hasAnySession}
        >
          <SelectTrigger id="measurement-select" className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Poids et indices</SelectLabel>
              {WEIGHT_AND_INDICES_ENTRIES.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Mensurations</SelectLabel>
              {MENSURATIONS_ENTRIES.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          {!hasAnySession ? (
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
          ) : isBmiHeightMissing ? (
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
                <EmptyTitle>
                  Aucune mesure {partitiveDe(entry.label)}
                </EmptyTitle>
                <EmptyDescription>
                  Cette mesure n&apos;a jamais été saisie. Ajoutez-la à
                  votre prochaine session pour voir la courbe apparaître.
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
                  {entry.formatValue(series[series.length - 1]!.value)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatFullDate(series[series.length - 1]!.t)}
                </span>
              </div>

              {/* s08 task 7: this row satisfies criterion 3 — the row
                  chiffre, the graph shows. --font-sans + tabular-nums
                  (s04 P2), never --font-mono. */}
              {effectiveTargetWeightKg !== null && gap !== null && (
                <div className="flex flex-col gap-0.5 font-sans text-sm tabular-nums text-muted-foreground">
                  <span>
                    Cible {formatMeasurementValue(effectiveTargetWeightKg, "kg")} ·
                    écart {formatTargetGap(gap)}
                  </span>
                  {isTargetReached(gap) && <span>Cible atteinte.</span>}
                </div>
              )}

              <MeasurementChart
                series={series}
                seriesLabel={entry.label}
                formatValue={entry.formatValue}
                targetWeightKg={effectiveTargetWeightKg}
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
    </div>
  );
}
