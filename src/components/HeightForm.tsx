"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldLegend,
  FieldLabel,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { DatePickerField } from "@/components/DatePickerField";
import { FieldInfoButton } from "@/components/FieldInfoButton";
import {
  RequiredFieldLabel,
  RequiredLegend,
  RequiredMark,
} from "@/components/RequiredMark";
import { todayIsoDate } from "@/lib/date";
import { formatFrenchNumber } from "@/lib/format-number";
import { focusFirstInvalidField } from "@/lib/form-focus";
import { EARLIEST_START_DATE, SEX_LABELS, SEX_VALUES } from "@/lib/onboarding";
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

const HEIGHT_REQUIRED_MESSAGE = "Indiquez votre taille.";
const SEX_REQUIRED_MESSAGE = "Choisissez homme ou femme.";
const START_DATE_REQUIRED_MESSAGE =
  "Indiquez le début de votre transformation.";

// On-screen order, for focusFirstInvalidField. The sex radiogroup is
// reachable because its container carries this id and tabIndex={-1} —
// without the tabindex the scroll would work and the focus would
// silently do nothing.
const FIELD_ORDER = [
  "heightCm",
  "sex",
  "targetWeightKg",
  "transformationStartedOn",
] as const;

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
 * loses what the user typed.
 *
 * type="text" + inputMode="decimal" + autoComplete="off" (P4) — never
 * type="number": its sanitization empties the value on a French comma,
 * which combined with R7 would turn "175,5" into a silent height removal.
 *
 * Two FieldSets, regrouped: the sex is a fact about the body, alongside
 * the height, not a parameter of the transformation — it selects which
 * silhouette is drawn and would be the same answer whatever the user
 * were training for. The target weight moved the other way, into
 * Transformation, where it belongs next to the date the count starts
 * from. Both fields are still submitted together to PUT /api/profile
 * under one button; only their grouping on screen changed.
 *
 * The per-field explanations are no longer paragraphs under each input
 * (they made a four-field form scroll): they live behind the info icon
 * glued to each field, in FieldInfoButton's modal.
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

  // Posed after mount, deliberately — the same trap MeasurementSessionForm
  // documents (plan decision 9): "today" computed during render runs on
  // the server too, in UTC, and would disagree with the device's own
  // calendar date. Empty until then, which simply means the picker has no
  // upper bound for one frame; the server refuses a future date either
  // way (START_DATE_FUTURE_ERROR).
  const [todayIso, setTodayIso] = useState("");
  const todaySet = useRef(false);
  useEffect(() => {
    if (todaySet.current) return;
    todaySet.current = true;
    setTodayIso(todayIsoDate());
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // The client-side gate: the three mandatory answers, refused before
    // the round trip and scrolled into view. Never a replacement for the
    // server's validation (AGENTS.md) — /api/profile re-checks all of
    // it, and owns every format and range verdict, which this does not
    // duplicate.
    const missingHeight = value.trim() === "";
    const missingSex = sex === null;
    const missingStartedOn = startedOn.trim() === "";

    setFieldError(missingHeight ? HEIGHT_REQUIRED_MESSAGE : null);
    setSexFieldError(missingSex ? SEX_REQUIRED_MESSAGE : null);
    setStartedOnFieldError(
      missingStartedOn ? START_DATE_REQUIRED_MESSAGE : null,
    );

    if (missingHeight || missingSex || missingStartedOn) {
      setTargetFieldError(null);
      setOperationError(null);
      focusFirstInvalidField(FIELD_ORDER, (fieldId) =>
        fieldId === "heightCm"
          ? missingHeight
          : fieldId === "sex"
            ? missingSex
            : fieldId === "transformationStartedOn"
              ? missingStartedOn
              : false,
      );
      return;
    }

    setSubmitting(true);
    setTargetFieldError(null);
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
          // other. The gate above already guarantees both are set by the
          // time this runs; the condition stays as the endpoint's own
          // contract, not as a second guess at it.
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
        const targetWasCleared = targetValue.trim() === "";

        if (heightChanged && !targetChanged) {
          toast.success("Taille enregistrée.");
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
        const nextHeight = body.fieldErrors?.heightCm?.[0] ?? null;
        const nextTarget = body.fieldErrors?.targetWeightKg?.[0] ?? null;
        const nextSex = body.fieldErrors?.sex?.[0] ?? null;
        const nextStartedOn =
          body.fieldErrors?.transformationStartedOn?.[0] ?? null;

        setFieldError(nextHeight);
        setTargetFieldError(nextTarget);
        setSexFieldError(nextSex);
        setStartedOnFieldError(nextStartedOn);

        // The server's verdict gets the same treatment as the client's:
        // scrolled to, not left for the user to hunt for.
        focusFirstInvalidField(FIELD_ORDER, (fieldId) =>
          fieldId === "heightCm"
            ? nextHeight !== null
            : fieldId === "sex"
              ? nextSex !== null
              : fieldId === "targetWeightKg"
                ? nextTarget !== null
                : nextStartedOn !== null,
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
      <RequiredLegend />

      <FieldSet>
        <FieldLegend>Informations</FieldLegend>

        <Field data-invalid={fieldError ? true : undefined}>
          <RequiredFieldLabel htmlFor="heightCm">
            Taille (cm)
          </RequiredFieldLabel>
          <InputGroup className="h-11">
            <InputGroupInput
              id="heightCm"
              name="heightCm"
              type="text"
              required
              inputMode="decimal"
              autoComplete="off"
              // h-11 on the CONTROL, not only on the InputGroup around
              // it: the design system's 44px floor is about the tap
              // target, and InputGroupInput's own base classes leave the
              // input at the group's default h-8 otherwise.
              className="h-11 text-base md:text-sm"
              placeholder="175"
              aria-invalid={fieldError ? true : undefined}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (fieldError) setFieldError(null);
              }}
            />
            <InputGroupAddon align="inline-end">
              <FieldInfoButton
                title="Taille"
                label="À propos de la taille"
              >
                Sert uniquement au calcul de l&apos;IMC. Elle n&apos;apparaît
                ni sur la silhouette ni dans les graphes. Elle est
                obligatoire : la vider vous ramènera à l&apos;écran de
                départ.
              </FieldInfoButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldError>{fieldError}</FieldError>
        </Field>

        <Field data-invalid={sexFieldError ? true : undefined}>
          {/* Same three-attribute radiogroup as OnboardingForm — the
              shadcn radio-group primitive isn't installed, and these two
              screens are the only places in the app that need one. */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <FieldLabel asChild>
                <span id="profile-sex-label">Sexe</span>
              </FieldLabel>
              <RequiredMark />
            </div>
            <FieldInfoButton title="Sexe" label="À propos du sexe">
              Détermine la silhouette affichée sur l&apos;accueil. Rien
              d&apos;autre dans l&apos;application n&apos;en dépend.
            </FieldInfoButton>
          </div>
          <div
            id="sex"
            tabIndex={-1}
            role="radiogroup"
            aria-labelledby="profile-sex-label"
            aria-invalid={sexFieldError ? true : undefined}
            className="grid grid-cols-2 gap-2 outline-none"
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
          <FieldError>{sexFieldError}</FieldError>
        </Field>
      </FieldSet>

      <FieldSeparator />

      <FieldSet>
        <FieldLegend>Transformation</FieldLegend>

        <Field data-invalid={targetFieldError ? true : undefined}>
          {/* No RequiredMark: the target is the one optional answer on
              this screen, and clearing it is a supported way to remove
              the reference line. */}
          <FieldLabel htmlFor="targetWeightKg">Poids cible (kg)</FieldLabel>
          <InputGroup className="h-11">
            <InputGroupInput
              id="targetWeightKg"
              name="targetWeightKg"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className="h-11 text-base md:text-sm"
              placeholder="70"
              aria-invalid={targetFieldError ? true : undefined}
              value={targetValue}
              onChange={(event) => {
                setTargetValue(event.target.value);
                if (targetFieldError) setTargetFieldError(null);
              }}
            />
            <InputGroupAddon align="inline-end">
              <FieldInfoButton
                title="Poids cible"
                label="À propos du poids cible"
              >
                Apparaît comme ligne de référence sur le graphe du poids,
                avec l&apos;écart depuis votre dernière pesée. Ne
                s&apos;applique à aucune autre mesure. Videz le champ pour
                retirer la cible.
              </FieldInfoButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldError>{targetFieldError}</FieldError>
        </Field>

        <Field data-invalid={startedOnFieldError ? true : undefined}>
          <div className="flex items-center justify-between gap-2">
            <RequiredFieldLabel htmlFor="transformationStartedOn">
              Début de la transformation
            </RequiredFieldLabel>
            <FieldInfoButton
              title="Début de la transformation"
              label="À propos du début de la transformation"
            >
              Le point de départ du compteur de jours affiché sur
              l&apos;accueil — le « J+42 » se compte à partir de cette date.
            </FieldInfoButton>
          </div>
          <DatePickerField
            id="transformationStartedOn"
            value={startedOn}
            invalid={startedOnFieldError !== null}
            // No future start date: the counter would read J+0 for it
            // anyway, and the server refuses it (START_DATE_FUTURE_ERROR).
            // The same window the server enforces (makeStartDateSchema):
            // never before 2000, never in the future.
            min={EARLIEST_START_DATE}
            max={todayIso === "" ? undefined : todayIso}
            onChange={(isoDate) => {
              setStartedOn(isoDate);
              setStartedOnFieldError(null);
            }}
          />
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
