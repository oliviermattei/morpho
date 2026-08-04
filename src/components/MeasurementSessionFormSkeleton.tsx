import { Button } from "@/components/ui/button";
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MEASUREMENT_CATALOG,
  type MeasurementCatalogEntry,
  type MeasurementKind,
} from "@/lib/measurements";

function requiredCatalogEntry(kind: MeasurementKind): MeasurementCatalogEntry {
  const entry = MEASUREMENT_CATALOG.find((candidate) => candidate.kind === kind);
  if (!entry) {
    throw new Error(`Unreachable: ${kind} missing from MEASUREMENT_CATALOG`);
  }
  return entry;
}

const WEIGHT_ENTRY = requiredCatalogEntry("weight_kg");

const MENSURATIONS_ENTRIES = MEASUREMENT_CATALOG.filter(
  (entry) => entry.group === "mensurations",
);
const COMPOSITION_ENTRIES = MEASUREMENT_CATALOG.filter(
  (entry) => entry.group === "composition",
);

/**
 * Plan task 3: reproduces the real form's shape (docs/designs/
 * s05-quick-entry-prefill.md, état "Chargement") — labels, groups and
 * order read from the same src/lib/measurements.ts source the real form
 * uses (locked by MeasurementSessionFormSkeleton.test.tsx's cross
 * assertion), a Skeleton at h-11 in place of each value, and a disabled
 * submit button. No shell is prerendered for free here (force-dynamic,
 * no cacheComponents) — this fallback is what buys the immediate paint
 * while <MeasurementSessionFormLoader> reads Neon.
 */
export function MeasurementSessionFormSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <Field>
        <FieldLabel>Date</FieldLabel>
        <Skeleton className="h-11 w-full" />
      </Field>

      <Field>
        <FieldLabel>{WEIGHT_ENTRY.label} (kg)</FieldLabel>
        <Skeleton className="h-11 w-full" />
      </Field>

      <FieldSeparator />

      <FieldSet>
        <FieldLegend>Mensurations (cm)</FieldLegend>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          {MENSURATIONS_ENTRIES.map((entry) => (
            <Field key={entry.kind}>
              <FieldLabel>{entry.label}</FieldLabel>
              <Skeleton className="h-11 w-full" />
            </Field>
          ))}
        </div>
      </FieldSet>

      <FieldSeparator />

      <FieldSet>
        <FieldLegend>Composition (%)</FieldLegend>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          {COMPOSITION_ENTRIES.map((entry) => (
            <Field key={entry.kind}>
              <FieldLabel>{entry.label}</FieldLabel>
              <Skeleton className="h-11 w-full" />
            </Field>
          ))}
        </div>
      </FieldSet>

      <Button type="button" className="h-11 w-full" disabled>
        Enregistrer la session
      </Button>
    </div>
  );
}
