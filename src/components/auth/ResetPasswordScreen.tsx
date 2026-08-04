"use client";

import { Fragment, type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  RESET_ERROR_MESSAGES,
  messageForCode,
  readErrorCode,
} from "@/lib/auth-errors";
import { SIGN_IN_PATH } from "@/lib/auth-routes";
import { MIN_PASSWORD_LENGTH, passwordSchema } from "@/lib/password";
import { focusFirstInvalidField } from "@/lib/form-focus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RequiredFieldLabel } from "@/components/RequiredMark";

/**
 * The second half of the reset flow: the screen the link in the mail lands
 * on. The token is not read here from the URL — the Server Component above
 * reads it and passes it down, which is what spares this screen the
 * useSearchParams() + Suspense boundary ADR 019 was glad to be rid of.
 *
 * `token` is null when the auth server redirected here with an error
 * instead of a token (a dead or already-used link). There is nothing to
 * submit in that case, so the form is not rendered at all: the only useful
 * action is to ask for a new link.
 */
export function ResetPasswordScreen({ token }: { token: string | null }) {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(
    null,
  );
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function submit(newPassword: string) {
    setIsPending(true);
    setOperationError(null);

    // Same two shapes as sign-in (ADR 019): the SDK sometimes resolves with
    // `{ error }` and sometimes rejects with a normalized AuthApiError.
    // Without the catch, a dead token would leave the button spinning
    // forever with no message.
    let error: { code?: string } | null = null;
    try {
      ({ error = null } = await authClient.resetPassword({
        newPassword,
        token: token ?? undefined,
      }));
    } catch (thrown) {
      error = readErrorCode(thrown);
    }

    if (error) {
      setOperationError(messageForCode(error.code, RESET_ERROR_MESSAGES));
      setIsPending(false);
      return;
    }

    // Resetting does not open a session — Better Auth revokes them instead.
    // The user lands on the sign-in screen with the password they just
    // chose, which is also the proof it was applied.
    router.replace(SIGN_IN_PATH);
    router.refresh();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = passwordSchema.safeParse(password);
    const mismatch = confirmation !== password;

    setPasswordError(
      parsed.success
        ? null
        : (parsed.error.issues[0]?.message ??
            `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`),
    );
    setConfirmationError(
      mismatch ? "Les deux mots de passe ne sont pas identiques." : null,
    );

    if (!parsed.success || mismatch) {
      focusFirstInvalidField(["password", "confirmation"], (fieldId) =>
        fieldId === "password" ? !parsed.success : mismatch,
      );
      return;
    }

    void submit(parsed.data);
  }

  return (
    <Fragment>
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Nouveau mot de passe
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {token
            ? "Choisissez le mot de passe qui remplacera l'ancien."
            : "Ce lien n'est plus valable."}
        </p>
      </div>

      {!token && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Lien expiré</AlertTitle>
          <AlertDescription>
            Un lien de réinitialisation ne sert qu&apos;une fois et pour une
            durée limitée. Demandez-en un nouveau depuis l&apos;écran de
            connexion.
          </AlertDescription>
        </Alert>
      )}

      {token && (
        <form
          onSubmit={handleSubmit}
          className="flex w-full flex-col gap-4"
          noValidate
        >
          {operationError && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>La réinitialisation a échoué</AlertTitle>
              <AlertDescription>{operationError}</AlertDescription>
            </Alert>
          )}
          <Field data-invalid={passwordError ? true : undefined}>
            <RequiredFieldLabel htmlFor="password">
              Nouveau mot de passe
            </RequiredFieldLabel>
            <Input
              id="password"
              name="password"
              required
              type="password"
              autoComplete="new-password"
              autoFocus
              className="h-11 text-base md:text-sm"
              aria-invalid={passwordError ? true : undefined}
              disabled={isPending}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (passwordError) setPasswordError(null);
              }}
            />
            {!passwordError && (
              <FieldDescription>
                {MIN_PASSWORD_LENGTH} caractères minimum.
              </FieldDescription>
            )}
            <FieldError>{passwordError}</FieldError>
          </Field>
          <Field data-invalid={confirmationError ? true : undefined}>
            <RequiredFieldLabel htmlFor="confirmation">
              Confirmation
            </RequiredFieldLabel>
            <Input
              id="confirmation"
              name="confirmation"
              required
              type="password"
              autoComplete="new-password"
              className="h-11 text-base md:text-sm"
              aria-invalid={confirmationError ? true : undefined}
              disabled={isPending}
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
                if (confirmationError) setConfirmationError(null);
              }}
            />
            <FieldError>{confirmationError}</FieldError>
          </Field>
          <Button type="submit" className="h-11 w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Spinner aria-label="Chargement" /> Enregistrement…
              </>
            ) : (
              "Enregistrer le mot de passe"
            )}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link href={SIGN_IN_PATH} className="underline underline-offset-4">
          Retour à la connexion
        </Link>
      </p>
    </Fragment>
  );
}
