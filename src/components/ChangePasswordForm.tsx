"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { focusFirstInvalidField } from "@/lib/form-focus";
import { MIN_PASSWORD_LENGTH, passwordSchema } from "@/lib/password";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { RequiredFieldLabel } from "@/components/RequiredMark";

const WRONG_PASSWORD_MESSAGE = "Mot de passe actuel incorrect.";
const MISMATCH_MESSAGE = "Les deux mots de passe ne correspondent pas.";
const SAME_PASSWORD_MESSAGE =
  "Le nouveau mot de passe doit être différent de l'actuel.";
const NETWORK_FAILURE_MESSAGE = "Vérifiez votre connexion et réessayez.";
const SUCCESS_MESSAGE = "Mot de passe modifié.";

// Neon Auth normalizes upstream failures into its own snake_case
// taxonomy before the app sees them (the reasoning SignInScreen.tsx
// documents at length for the sign-in codes). A wrong current password
// is the one case worth naming: everything else is a retry.
const WRONG_PASSWORD_CODES = new Set([
  "invalid_credentials",
  "invalid_password",
  "INVALID_PASSWORD",
]);

function readErrorCode(thrown: unknown): string | undefined {
  const candidates: unknown[] = [
    thrown,
    (thrown as { body?: unknown })?.body,
    (thrown as { error?: unknown })?.error,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "object" && candidate !== null) {
      const { code } = candidate as { code?: unknown };
      if (typeof code === "string") return code;
    }
  }
  return undefined;
}

const FIELD_ORDER = [
  "currentPassword",
  "newPassword",
  "confirmPassword",
] as const;

/**
 * "Changer mon mot de passe", on /profil.
 *
 * `revokeOtherSessions: true` is deliberate and is the reason a password
 * change is worth having at all here: the plausible reason to change one
 * is that the old one is compromised, and leaving every other signed-in
 * device live would make the change cosmetic.
 */
export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [operationError, setOperationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOperationError(null);

    const nextErrors: Partial<Record<string, string>> = {};

    if (currentPassword === "") {
      nextErrors.currentPassword = "Indiquez votre mot de passe actuel.";
    }

    const parsedNew = passwordSchema.safeParse(newPassword);
    if (!parsedNew.success) {
      nextErrors.newPassword =
        parsedNew.error.issues[0]?.message ??
        `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`;
    } else if (newPassword === currentPassword) {
      nextErrors.newPassword = SAME_PASSWORD_MESSAGE;
    }

    if (confirmPassword !== newPassword) {
      nextErrors.confirmPassword = MISMATCH_MESSAGE;
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalidField(
        FIELD_ORDER,
        (fieldId) => nextErrors[fieldId] !== undefined,
      );
      return;
    }

    setSubmitting(true);

    // Same two-shapes handling as SignInScreen: the documented
    // `{ error }` tuple is not the only thing this SDK produces — a
    // rejected promise is the other, and an unhandled rejection here
    // would leave the button stuck on "Enregistrement…" forever.
    let code: string | undefined;
    let failed = false;
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        failed = true;
        code = error.code;
      }
    } catch (thrown) {
      failed = true;
      code = readErrorCode(thrown);
    }

    setSubmitting(false);

    if (failed) {
      if (code !== undefined && WRONG_PASSWORD_CODES.has(code)) {
        setErrors({ currentPassword: WRONG_PASSWORD_MESSAGE });
        focusFirstInvalidField(FIELD_ORDER, (id) => id === "currentPassword");
        return;
      }
      setOperationError(NETWORK_FAILURE_MESSAGE);
      return;
    }

    toast.success(SUCCESS_MESSAGE);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setErrors({});
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <FieldSet>
        <FieldLegend>Mot de passe</FieldLegend>

        <Field data-invalid={errors.currentPassword ? true : undefined}>
          <RequiredFieldLabel htmlFor="currentPassword">
            Mot de passe actuel
          </RequiredFieldLabel>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className="h-11 text-base md:text-sm"
            aria-invalid={errors.currentPassword ? true : undefined}
            disabled={submitting}
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              if (errors.currentPassword) {
                setErrors((c) => ({ ...c, currentPassword: undefined }));
              }
            }}
          />
          <FieldError>{errors.currentPassword}</FieldError>
        </Field>

        <Field data-invalid={errors.newPassword ? true : undefined}>
          <RequiredFieldLabel htmlFor="newPassword">
            Nouveau mot de passe
          </RequiredFieldLabel>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            autoComplete="new-password"
            className="h-11 text-base md:text-sm"
            aria-invalid={errors.newPassword ? true : undefined}
            disabled={submitting}
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              if (errors.newPassword) {
                setErrors((c) => ({ ...c, newPassword: undefined }));
              }
            }}
          />
          {!errors.newPassword && (
            <FieldDescription>
              {MIN_PASSWORD_LENGTH} caractères minimum.
            </FieldDescription>
          )}
          <FieldError>{errors.newPassword}</FieldError>
        </Field>

        <Field data-invalid={errors.confirmPassword ? true : undefined}>
          <RequiredFieldLabel htmlFor="confirmPassword">
            Confirmer le nouveau mot de passe
          </RequiredFieldLabel>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            className="h-11 text-base md:text-sm"
            aria-invalid={errors.confirmPassword ? true : undefined}
            disabled={submitting}
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              if (errors.confirmPassword) {
                setErrors((c) => ({ ...c, confirmPassword: undefined }));
              }
            }}
          />
          <FieldError>{errors.confirmPassword}</FieldError>
        </Field>
      </FieldSet>

      {operationError && (
        <Alert variant="destructive">
          <AlertDescription>{operationError}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        variant="outline"
        className="h-11 w-full"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Spinner aria-label="Chargement" /> Enregistrement…
          </>
        ) : (
          "Changer le mot de passe"
        )}
      </Button>
    </form>
  );
}
