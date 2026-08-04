"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DatePickerField } from "@/components/DatePickerField";
import { EARLIEST_START_DATE, SEX_LABELS, SEX_VALUES } from "@/lib/onboarding";
import type { ProfileSex } from "@/lib/profile";
import { cn } from "@/lib/utils";

/**
 * ADR 020. Three questions, asked once, before the app opens — and the
 * same three fields /profil mounts afterwards (SexAndStartDateFields is
 * the shared part; this screen adds the height and the framing copy).
 *
 * No client-side validation duplicated here beyond "required": the
 * server owns every rule (src/lib/onboarding.ts), and its fieldErrors
 * come back keyed by field name. Re-implementing the ranges in the
 * browser would create two sources of truth for what a valid start date
 * is, and the browser's copy would be the one that drifts.
 */

const GENERIC_ERROR = "Vérifiez votre connexion et réessayez.";

export interface OnboardingFormProps {
  initialHeightCm: number | null;
  initialSex: ProfileSex | null;
  initialStartedOn: string | null;
  /** Where to go once the profile is complete. */
  redirectTo: string;
  submitLabel: string;
}

type FieldErrors = Partial<
  Record<"heightCm" | "sex" | "transformationStartedOn", string[]>
>;

export function OnboardingForm({
  initialHeightCm,
  initialSex,
  initialStartedOn,
  redirectTo,
  submitLabel,
}: OnboardingFormProps) {
  const router = useRouter();

  const [heightCm, setHeightCm] = useState(
    initialHeightCm === null ? "" : String(initialHeightCm),
  );
  const [sex, setSex] = useState<ProfileSex | null>(initialSex);
  const [startedOn, setStartedOn] = useState(initialStartedOn ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOperationError(null);

    // The only rule this component owns: sex has no empty representation
    // to send, so "not chosen yet" has to be caught before the request.
    if (sex === null) {
      setFieldErrors({ sex: ["Choisissez homme ou femme."] });
      return;
    }
    setFieldErrors({});
    setIsSaving(true);

    let response: Response;
    try {
      response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          heightCm,
          // Onboarding never sets a target weight — the screen doesn't
          // ask for one. "" is this endpoint's documented "no value"
          // (src/lib/target-weight.ts), not a placeholder.
          targetWeightKg: "",
          sex,
          transformationStartedOn: startedOn,
        }),
      });
    } catch {
      setOperationError(GENERIC_ERROR);
      setIsSaving(false);
      return;
    }

    if (response.status === 400) {
      const body = (await response.json().catch(() => null)) as {
        fieldErrors?: FieldErrors;
      } | null;
      setFieldErrors(body?.fieldErrors ?? {});
      setIsSaving(false);
      return;
    }

    if (!response.ok) {
      setOperationError(GENERIC_ERROR);
      setIsSaving(false);
      return;
    }

    // refresh() before push(): the destination is a Server Component
    // gated on this very profile (src/lib/onboarding-gate.ts). Without
    // it, the router can serve a cached tree rendered while the profile
    // was still incomplete — which would bounce straight back here.
    router.refresh();
    router.push(redirectTo);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5" noValidate>
      {operationError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>L&apos;enregistrement a échoué</AlertTitle>
          <AlertDescription>{operationError}</AlertDescription>
        </Alert>
      )}

      <Field data-invalid={fieldErrors.heightCm ? true : undefined}>
        <FieldLabel htmlFor="heightCm">Taille</FieldLabel>
        <Input
          id="heightCm"
          name="heightCm"
          inputMode="decimal"
          autoComplete="off"
          placeholder="175"
          className="h-11 text-base md:text-sm"
          aria-invalid={fieldErrors.heightCm ? true : undefined}
          disabled={isSaving}
          value={heightCm}
          onChange={(event) => setHeightCm(event.target.value)}
        />
        <FieldDescription>En centimètres.</FieldDescription>
        <FieldError>{fieldErrors.heightCm?.[0]}</FieldError>
      </Field>

      <Field data-invalid={fieldErrors.sex ? true : undefined}>
        {/* A radiogroup, not two independent buttons: the two options are
            mutually exclusive and arrow keys must move between them. The
            shadcn radio-group primitive isn't installed, and this is the
            only place in the app that needs one — the ARIA pattern is
            three attributes, a component would be more machinery than
            the thing it wraps. */}
        <FieldLabel asChild>
          <span id="sex-label">Sexe</span>
        </FieldLabel>
        <div
          role="radiogroup"
          aria-labelledby="sex-label"
          aria-invalid={fieldErrors.sex ? true : undefined}
          className="grid grid-cols-2 gap-2"
        >
          {SEX_VALUES.map((value) => (
            <Button
              key={value}
              type="button"
              role="radio"
              aria-checked={sex === value}
              variant={sex === value ? "default" : "outline"}
              className={cn("h-11 w-full")}
              disabled={isSaving}
              onClick={() => {
                setSex(value);
                setFieldErrors((current) => ({ ...current, sex: undefined }));
              }}
            >
              {SEX_LABELS[value]}
            </Button>
          ))}
        </div>
        <FieldDescription>
          Détermine la silhouette affichée sur l&apos;accueil.
        </FieldDescription>
        <FieldError>{fieldErrors.sex?.[0]}</FieldError>
      </Field>

      <Field data-invalid={fieldErrors.transformationStartedOn ? true : undefined}>
        <FieldLabel htmlFor="transformationStartedOn">
          Début de la transformation
        </FieldLabel>
        <DatePickerField
          id="transformationStartedOn"
          // Same floor the server applies (makeStartDateSchema).
          min={EARLIEST_START_DATE}
          invalid={fieldErrors.transformationStartedOn !== undefined}
          disabled={isSaving}
          value={startedOn}
          onChange={setStartedOn}
        />
        <FieldDescription>
          Le point de départ du compteur de jours.
        </FieldDescription>
        <FieldError>{fieldErrors.transformationStartedOn?.[0]}</FieldError>
      </Field>

      <Button type="submit" className="h-11 w-full" disabled={isSaving}>
        {isSaving ? (
          <>
            <Spinner aria-label="Chargement" /> Enregistrement…
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
