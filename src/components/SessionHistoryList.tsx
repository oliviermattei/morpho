import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { computeBmi, formatBmi } from "@/lib/bmi";
import { formatSessionDate } from "@/lib/date";
import { routes } from "@/lib/routes";
import type { MeasurementSessionSummary } from "@/lib/measurement-sessions";
import {
  MEASUREMENT_CATALOG_BY_KIND,
  formatMeasurementValue,
} from "@/lib/measurements";

/**
 * Purely presentational (plan task 6, extended by task 9) — no database
 * access, so it stays testable without PGlite. `formatSessionDate` is
 * always called with "UTC": measuredOn is a calendar date, not an
 * instant, and the noon-UTC anchor inside formatSessionDate already
 * makes the rendered date timezone-independent — there is no user
 * timezone to thread through an RSC render here.
 *
 * `heightCm` (task 9, design §B): the suffix "IMC 23,6" appears in
 * text-muted-foreground, only on a line that carries a weight measurement
 * and only once a height is known — computeBmi/formatBmi (src/lib/bmi.ts)
 * are the only source, so changing heightCm here recomputes every past
 * session's IMC by construction (criterion 5), with no write.
 */
export function SessionHistoryList({
  sessions,
  heightCm,
}: {
  sessions: MeasurementSessionSummary[];
  heightCm: number | null;
}) {
  if (sessions.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Aucune session enregistrée</EmptyTitle>
          <EmptyDescription>
            Vos mesures apparaîtront ici, de la plus récente à la plus
            ancienne.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild className="h-11 w-full">
            <Link href="/saisie">Saisir mes mesures</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <ItemGroup>
      {sessions.map((session) => {
        const weight = session.measurements.find(
          (measurement) => measurement.kind === "weight_kg",
        );
        const bmi = computeBmi(weight?.value ?? null, heightCm);

        return (
          // s09 R9/D1: the whole row opens the edit screen — a Link
          // wrapping the Item (asChild), never a second interactive
          // element nested inside it (no ItemActions, no delete button
          // here — R9's own reasoning: a destructive control on a
          // thumb-tapped card, and alert-dialog would force this whole
          // Server Component list client). "Modifier" is plain text, not
          // a control of its own.
          <Item key={session.id} variant="outline" asChild>
            <Link href={routes.sessionEdit(session.id)}>
              <ItemContent>
                <div className="flex items-center justify-between gap-2">
                  <ItemTitle>
                    {formatSessionDate(session.measuredOn, "UTC")}
                  </ItemTitle>
                  {/* The word "Modifier" is gone, but the affordance it
                      carried is not: the whole row still opens the edit
                      screen, and a chevron says so without spending a
                      line of text per session on saying it. */}
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                {/* Two columns: a full session is 10 measurements, which
                    as a single stacked list made one card taller than the
                    viewport and pushed the next session entirely out of
                    sight. */}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {session.measurements.map((measurement) => {
                    const entry = MEASUREMENT_CATALOG_BY_KIND[measurement.kind];
                    return (
                      <div
                        key={measurement.kind}
                        className="flex items-baseline justify-between gap-2 text-sm"
                      >
                        <dt className="truncate text-muted-foreground">
                          {entry.label}
                        </dt>
                        <dd className="shrink-0 font-mono tabular-nums">
                          {formatMeasurementValue(measurement.value, entry.unit)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                {bmi !== null && (
                  <p className="text-sm text-muted-foreground">
                    IMC {formatBmi(bmi)}
                  </p>
                )}
              </ItemContent>
            </Link>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
