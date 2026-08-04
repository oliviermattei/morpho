import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { computeBmi, formatBmi } from "@/lib/bmi";
import { formatSessionDate } from "@/lib/date";
import type { LatestWeighIn } from "@/lib/measurement-sessions";
import { formatMeasurementValue } from "@/lib/measurements";

interface BmiCardProps {
  heightCm: number | null;
  latestWeighIn: LatestWeighIn | null;
}

/**
 * Server Component, presentational only — no database access (plan task
 * 9). Three cases, but only two ever render something (review finding
 * 4, design §States "Affichage de l'IMC", "Vide — aucune session avec
 * poids"): no height at all shows the "Pas encore d'IMC" invitation —
 * the field just above it is genuinely empty, so the text is true; a
 * height that IS set but no weigh-in yet renders nothing, because the
 * design explicitly says a taille set changes nothing about that empty
 * case — showing the no-height invitation there would contradict the
 * field just above it. The value case always goes through
 * computeBmi/formatBmi (src/lib/bmi.ts), the single source that makes
 * criterion 5 true by construction.
 */
export function BmiCard({ heightCm, latestWeighIn }: BmiCardProps) {
  if (heightCm === null) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Pas encore d&apos;IMC</EmptyTitle>
          <EmptyDescription>
            Votre IMC apparaîtra ici dès que votre taille sera enregistrée.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const bmi = computeBmi(latestWeighIn?.weightKg ?? null, heightCm);

  if (bmi === null || latestWeighIn === null) {
    return null;
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">IMC actuel</p>
        <p className="text-2xl font-semibold tabular-nums">
          {formatBmi(bmi)}
        </p>
        <p className="text-sm text-muted-foreground">
          d&apos;après {formatMeasurementValue(latestWeighIn.weightKg, "kg")},{" "}
          {formatSessionDate(latestWeighIn.measuredOn, "UTC")}
        </p>
        <p className="text-sm text-muted-foreground">
          Recalculé sur vos {latestWeighIn.sessionsWithWeightCount} sessions.
        </p>
      </CardContent>
    </Card>
  );
}
