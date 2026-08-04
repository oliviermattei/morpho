"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLegend,
  FieldLabel,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatFrenchNumber } from "@/lib/format-number";
import { SEX_LABELS, SEX_VALUES } from "@/lib/onboarding";
import type { ProfileSex } from "@/lib/profile";
import { cn } from "@/lib/utils";

const OPERATION_FAILURE_MESSAGE =
  "Enregistrement impossible pour l'instant. Réessayez.";

// Plan decision P6, review finding 3: a 401 here is the normal shape of
// an expired session (sessionDataTtl: 300, src/lib/auth.ts), not a
// transport/server failure — OPERATION_FAILURE_MESSAGE would tell the
// user to retry a save that can never succeed until they sign in again.
// Mirrors MeasurementSessionForm.tsx's own fix for the same class of bug
// (s03 review finding 2), rather than inventing a second shape for it.
const SESSION_EXPIRED_MESSAGE = "Votre session a expiré.";

interface HeightFormProps {
  initialHeightCm: number | null;
  // s08 task 6: the second FieldSet added to this same form. Optional,
  // defaulting to null, so no existing caller/test that predates the
  // target field needs to change.
  initialTargetWeightKg?: number | null;
  // ADR 020: the two onboarding answers, editable here — "updatable dans
  // profil" is the whole reason the onboarding is allowed to be
  // mandatory. Optional and defaulting to null so no existing
  // caller/test that predates them needs to change.
  initialSex?: ProfileSex | null;
  initialStartedOn?: string | null;
}

/**
 * "use client", controlled field (R3, task 8): onSubmit + fetch, not a
 * form action — React DOM's action machinery (requestFormReset before the
 * action runs, stateNode.reset() on commit) never applies to a plain
 * onSubmit handler, and a controlled `value` resynchronizes React's own
 * defaultValue on every render regardless, so a rejected submission never
 * loses what the user typed (review s03, finding on this exact class of
 * bug; test below: after a 400, the field still contains the refused
 * value).
 *
 * type="text" + inputMode="decimal" + autoComplete="off" (P4) — never
 * type="number": its sanitization empties the value on a French comma,
 * which combined with R7 would turn "175,5" into a silent height removal.
 *
 * s08 task 6: a second FieldSet for the target weight, in the SAME form
 * and under the SAME single "Enregistrer" button (the story's own scope
 * note — no second write mechanism). Both fields are always submitted
 * together to PUT /api/profile.
 */
export function HeightForm({
  initialHeightCm,
  initialTargetWeightKg = null,
  initialSex = null,
  initialStartedOn = null,
}: HeightFormProps) {
  const router = useRouter();
  const initialHeightDisplay =
    initialHeightCm === null ? "" : formatFrenchNumber(initialHeightCm);
  const initialTargetDisplay =
    initialTargetWeightKg === null ? "" : formatFrenchNumber(initialTargetWeightKg);
  const [value, setValue] = useState(initialHeightDisplay);
  const [targetValue, setTargetValue] = useState(initialTargetDisplay);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [targetFieldError, setTargetFieldError] = useState<string | null>(null);
  const [sex, setSex] = useState<ProfileSex | null>(initialSex);
  const [startedOn, setStartedOn] = useState(initialStartedOn ?? "");
  const [sexFieldError, setSexFieldError] = useState<string | null>(null);
  const [startedOnFieldError, setStartedOnFieldError] = useState<string | null>(
    null,
  );
  const [operationError, setOperationError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFieldError(null);
    setTargetFieldError(null);
    setSexFieldError(null);
    setStartedOnFieldError(null);
    setOperationError(null);
    setSessionExpired(false);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          heightCm: value,
          targetWeightKg: targetValue,
          // Sent only when BOTH are filled in. The endpoint treats them
          // as an optional pair (ADR 020) and refuses one without the
          // other — a profile written before the redesign opens this
          // form with neither, and must still be able to save its
          // height without being told to pick a sex first.
          ...(sex !== null && startedOn.trim() !== ""
            ? { sex, transformationStartedOn: startedOn }
            : {}),
        }),
      });

      if (response.status === 200) {
        // R7/R10: the toast names what changed in THIS submission — one
        // message when only one of the two fields moved, a generic one
        // when both did (or neither, on a plain resubmit).
        const heightChanged = value.trim() !== initialHeightDisplay;
        const targetChanged = targetValue.trim() !== initialTargetDisplay;
        const heightWasCleared = value.trim() === "";
        const targetWasCleared = targetValue.trim() === "";

        if (heightChanged && !targetChanged) {
          toast.success(heightWasCleared ? "Taille retirée." : "Taille enregistrée.");
        } else if (targetChanged && !heightChanged) {
          toast.success(
            targetWasCleared ? "Poids cible retiré." : "Poids cible enregistré.",
          );
        } else {
          toast.success("Profil enregistré.");
        }
        router.refresh();
        return;
      }

      if (response.status === 400) {
        const body = (await response.json()) as {
          fieldErrors?: Record<string, string[]>;
        };
        setFieldError(body.fieldErrors?.heightCm?.[0] ?? null);
        setTargetFieldError(body.fieldErrors?.targetWeightKg?.[0] ?? null);
        setSexFieldError(body.fieldErrors?.sex?.[0] ?? null);
        setStartedOnFieldError(
          body.fieldErrors?.transformationStartedOn?.[0] ?? null,
        );
        return;
      }

      if (response.status === 401) {
        setSessionExpired(true);
        return;
      }

      setOperationError(OPERATION_FAILURE_MESSAGE);
    } catch {
      setOperationError(OPERATION_FAILURE_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <FieldSet>
        <FieldLegend>Taille de référence</FieldLegend>
        <Field data-invalid={fieldError ? true : undefined}>
          <FieldLabel htmlFor="heightCm">Taille (cm)</FieldLabel>
          <Input
            id="heightCm"
            name="heightCm"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="175"
            className="h-11 text-base md:text-sm"
            aria-invalid={fieldError ? true : undefined}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <FieldDescription>
            Sert uniquement au calcul de l&apos;IMC. Elle n&apos;apparaît ni
            sur la silhouette ni dans les graphes. Elle est obligatoire :
            la vider vous ramènera à l&apos;écran de départ.
          </FieldDescription>
          <FieldError>{fieldError}</FieldError>
        </Field>
      </FieldSet>

      <FieldSeparator />

      <FieldSet>
        <FieldLegend>Poids cible</FieldLegend>
        <Field data-invalid={targetFieldError ? true : undefined}>
          <FieldLabel htmlFor="targetWeightKg">Poids cible (kg)</FieldLabel>
          <Input
            id="targetWeightKg"
            name="targetWeightKg"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="70"
            className="h-11 text-base md:text-sm"
            aria-invalid={targetFieldError ? true : undefined}
            value={targetValue}
            onChange={(event) => setTargetValue(event.target.value)}
          />
          <FieldDescription>
            Apparaît comme ligne de référence sur le graphe du poids, avec
            l&apos;écart depuis votre dernière pesée. Ne s&apos;applique à
            aucune autre mesure. Videz le champ pour retirer la cible.
          </FieldDescription>
          <FieldError>{targetFieldError}</FieldError>
        </Field>
      </FieldSet>

      <FieldSeparator />

      <FieldSet>
        <FieldLegend>Transformation</FieldLegend>
        <Field data-invalid={sexFieldError ? true : undefined}>
          {/* Same three-attribute radiogroup as OnboardingForm — the
              shadcn radio-group primitive isn't installed, and these two
              screens are the only places in the app that need one. */}
          <FieldLabel asChild>
            <span id="profile-sex-label">Sexe</span>
          </FieldLabel>
          <div
            role="radiogroup"
            aria-labelledby="profile-sex-label"
            aria-invalid={sexFieldError ? true : undefined}
            className="grid grid-cols-2 gap-2"
          >
            {SEX_VALUES.map((option) => (
              <Button
                key={option}
                type="button"
                role="radio"
                aria-checked={sex === option}
                variant={sex === option ? "default" : "outline"}
                className={cn("h-11 w-full")}
                onClick={() => {
                  setSex(option);
                  setSexFieldError(null);
                }}
              >
                {SEX_LABELS[option]}
              </Button>
            ))}
          </div>
          <FieldDescription>
            Détermine la silhouette affichée sur l&apos;accueil.
          </FieldDescription>
          <FieldError>{sexFieldError}</FieldError>
        </Field>

        <Field data-invalid={startedOnFieldError ? true : undefined}>
          <FieldLabel htmlFor="transformationStartedOn">
            Début de la transformation
          </FieldLabel>
          <Input
            id="transformationStartedOn"
            name="transformationStartedOn"
            type="date"
            className="h-11 text-base md:text-sm"
            aria-invalid={startedOnFieldError ? true : undefined}
            value={startedOn}
            onChange={(event) => setStartedOn(event.target.value)}
          />
          <FieldDescription>
            Le point de départ du compteur de jours affiché sur
            l&apos;accueil.
          </FieldDescription>
          <FieldError>{startedOnFieldError}</FieldError>
        </Field>
      </FieldSet>

      {sessionExpired && (
        <Alert variant="destructive">
          <AlertDescription>
            {SESSION_EXPIRED_MESSAGE}{" "}
            <Link href="/auth/sign-in">Se reconnecter</Link>
          </AlertDescription>
        </Alert>
      )}

      {!sessionExpired && operationError && (
        <Alert variant="destructive">
          <AlertDescription>{operationError}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="h-11 w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Spinner aria-label="Chargement" /> Enregistrement…
          </>
        ) : (
          "Enregistrer"
        )}
      </Button>
    </form>
  );
}
