"use client";

import { Fragment, type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { MIN_PASSWORD_LENGTH, passwordSchema } from "@/lib/password";
import { focusFirstInvalidField } from "@/lib/form-focus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RequiredFieldLabel, RequiredLegend } from "@/components/RequiredMark";

// ADR 019: email + password replaces the magic link as the only sign-in
// path. Neon Auth's beta wraps Better Auth verbatim, and its credential
// provider is enabled on this project — verified against the live auth
// server, not inferred: POST /sign-up/email returns 200 with a session
// token and a `__Secure-neon-auth.session_token` cookie even though
// `emailVerified` is false, and POST /sign-in/email on that account returns
// 200. No mailbox is involved at any point, which is the whole reason for
// the change: the magic link could not be exercised end-to-end.
//
// design-system.md §Patterns UI: "field, pas form" — validation is Zod +
// React state, not react-hook-form (not in the stack, radix-nova style).
const emailSchema = z.email("Cette adresse email n'est pas valide.");

// MIN_PASSWORD_LENGTH / passwordSchema moved to src/lib/password.ts when
// /profil gained its own "changer mon mot de passe" form — one rule, one
// definition, imported by both screens.

const NETWORK_FAILURE_MESSAGE = "Vérifiez votre connexion et réessayez.";

const WRONG_CREDENTIALS_MESSAGE = "Email ou mot de passe incorrect.";
const ACCOUNT_TAKEN_MESSAGE = "Un compte existe déjà avec cette adresse email.";

// Error codes mapped to French. The snake_case codes are Neon Auth's own
// taxonomy (AuthErrorCode in
// node_modules/@neondatabase/auth/dist/better-auth-helpers-*.mjs), NOT
// Better Auth's: the SDK normalizes every upstream failure into an
// AuthApiError before the app sees it. Confirmed on the live server — a
// wrong password arrives as `invalid_credentials`, never as Better Auth's
// own `INVALID_EMAIL_OR_PASSWORD`, which is what the route handler returns
// one layer below. The SCREAMING_SNAKE entries are kept as a safety net for
// the `{ error }` tuple path, which does not go through the normalizer.
//
// Anything unlisted falls back to the retry message: a code we don't know
// about is still a failure the user can only retry.
const ERROR_MESSAGES: Record<string, string> = {
  // Neon Auth normalized codes
  invalid_credentials: WRONG_CREDENTIALS_MESSAGE,
  // Deliberately the same message as a wrong password: on the sign-in
  // screen, distinguishing them would tell an attacker which addresses
  // have an account here.
  user_not_found: WRONG_CREDENTIALS_MESSAGE,
  user_already_exists: ACCOUNT_TAKEN_MESSAGE,
  email_exists: ACCOUNT_TAKEN_MESSAGE,
  email_address_invalid: "Cette adresse email n'est pas valide.",
  email_not_confirmed: "Cette adresse email n'est pas encore vérifiée.",
  weak_password: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`,
  validation_failed: "Vérifiez les informations saisies.",
  over_request_rate_limit:
    "Trop de tentatives. Réessayez dans quelques minutes.",
  session_expired: "Votre session a expiré. Reconnectez-vous.",
  session_not_found: "Votre session a expiré. Reconnectez-vous.",
  // Better Auth raw codes, in case a call resolves with `{ error }`
  // instead of rejecting
  INVALID_EMAIL_OR_PASSWORD: WRONG_CREDENTIALS_MESSAGE,
  USER_ALREADY_EXISTS: ACCOUNT_TAKEN_MESSAGE,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: ACCOUNT_TAKEN_MESSAGE,
  PASSWORD_TOO_SHORT: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`,
  PASSWORD_TOO_LONG: "Ce mot de passe est trop long.",
  EMAIL_NOT_VERIFIED: "Cette adresse email n'est pas encore vérifiée.",
  CREDENTIAL_ACCOUNT_NOT_FOUND: WRONG_CREDENTIALS_MESSAGE,
};

/**
 * Digs the Better Auth error code out of whatever the SDK rejected with.
 * A rejected sign-in surfaces as an APIError whose code sits either on the
 * object itself or one level down under `body`/`error`; a genuine network
 * failure rejects with a plain TypeError and no code at all, which maps to
 * the retry message.
 */
function readErrorCode(thrown: unknown): { code?: string } {
  if (typeof thrown !== "object" || thrown === null) return {};
  const candidates: unknown[] = [
    thrown,
    (thrown as { body?: unknown }).body,
    (thrown as { error?: unknown }).error,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "object" && candidate !== null) {
      const { code } = candidate as { code?: unknown };
      if (typeof code === "string") return { code };
    }
  }
  return {};
}

type Mode = "sign-in" | "sign-up";

const COPY: Record<
  Mode,
  {
    title: string;
    subtitle: string;
    submit: string;
    pending: string;
    switchPrompt: string;
    switchAction: string;
    failureTitle: string;
  }
> = {
  "sign-in": {
    title: "Connexion",
    subtitle: "Entrez votre email et votre mot de passe.",
    submit: "Se connecter",
    pending: "Connexion…",
    switchPrompt: "Pas encore de compte ?",
    switchAction: "Créer un compte",
    failureTitle: "La connexion a échoué",
  },
  "sign-up": {
    title: "Créer un compte",
    subtitle: "Choisissez un email et un mot de passe.",
    submit: "Créer le compte",
    pending: "Création…",
    switchPrompt: "Vous avez déjà un compte ?",
    switchAction: "Se connecter",
    failureTitle: "La création du compte a échoué",
  },
};

export function SignInScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const copy = COPY[mode];

  function switchMode() {
    setMode(mode === "sign-in" ? "sign-up" : "sign-in");
    setEmailError(null);
    setPasswordError(null);
    setOperationError(null);
  }

  async function submit(validEmail: string, validPassword: string) {
    setIsPending(true);
    setOperationError(null);

    // The `{ data, error }` tuple is the documented shape, but it is not the
    // only one that happens: reproduced in a real browser against the live
    // auth server, a 401 from /sign-in/email REJECTS the promise instead of
    // resolving with `{ error }`. Without this try/catch the rejection
    // escapes `void submit(...)`, `setIsPending(false)` never runs, and the
    // button stays stuck on "Connexion…" forever with no message — the user
    // is simply locked out with no way to know why. Both shapes are handled;
    // whichever one the SDK produces, the code is read from the same place.
    let error: { code?: string } | null = null;
    try {
      ({ error = null } =
        mode === "sign-in"
          ? await authClient.signIn.email({
              email: validEmail,
              password: validPassword,
            })
          : await authClient.signUp.email({
              email: validEmail,
              password: validPassword,
              // Better Auth requires a name on sign-up. morpho is a
              // single-person app and never displays it, so asking for one
              // would be a field with no purpose — derive it from the
              // address rather than invent a screen for it.
              name: validEmail.split("@")[0] ?? validEmail,
            }));
    } catch (thrown) {
      error = readErrorCode(thrown);
    }

    if (error) {
      setOperationError(
        (error.code && ERROR_MESSAGES[error.code]) ?? NETWORK_FAILURE_MESSAGE,
      );
      setIsPending(false);
      return;
    }

    // Both endpoints set the session cookies on this origin (the browser
    // only ever talks to /api/auth/**, proxied by
    // src/app/api/auth/[...path]/route.ts). refresh() re-runs the Server
    // Components with those cookies; without it the push lands on a tree
    // rendered while the user was still anonymous.
    router.replace("/");
    router.refresh();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedEmail = emailSchema.safeParse(email);
    const parsedPassword = passwordSchema.safeParse(password);

    setEmailError(
      parsedEmail.success
        ? null
        : (parsedEmail.error.issues[0]?.message ??
            "Cette adresse email n'est pas valide."),
    );
    setPasswordError(
      parsedPassword.success
        ? null
        : (parsedPassword.error.issues[0]?.message ??
            `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`),
    );

    if (!parsedEmail.success || !parsedPassword.success) {
      // Both fields are above the fold on this screen, so the scroll is
      // usually a no-op — the focus is the point: the refused field is
      // where the caret lands, so correcting it takes no aiming.
      focusFirstInvalidField(["email", "password"], (fieldId) =>
        fieldId === "email" ? !parsedEmail.success : !parsedPassword.success,
      );
      return;
    }

    void submit(parsedEmail.data, parsedPassword.data);
  }

  return (
    <Fragment>
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{copy.title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{copy.subtitle}</p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-4"
        noValidate
      >
        {operationError && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>{copy.failureTitle}</AlertTitle>
            <AlertDescription>{operationError}</AlertDescription>
          </Alert>
        )}
        <RequiredLegend />
        <Field data-invalid={emailError ? true : undefined}>
          <RequiredFieldLabel htmlFor="email">
            Adresse email
          </RequiredFieldLabel>
          <Input
            id="email"
            name="email"
            required
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            placeholder="vous@exemple.fr"
            className="h-11 text-base md:text-sm"
            aria-invalid={emailError ? true : undefined}
            disabled={isPending}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (emailError) setEmailError(null);
            }}
          />
          <FieldError>{emailError}</FieldError>
        </Field>
        <Field data-invalid={passwordError ? true : undefined}>
          <RequiredFieldLabel htmlFor="password">
            Mot de passe
          </RequiredFieldLabel>
          <Input
            id="password"
            name="password"
            required
            type="password"
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            className="h-11 text-base md:text-sm"
            aria-invalid={passwordError ? true : undefined}
            disabled={isPending}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (passwordError) setPasswordError(null);
            }}
          />
          {mode === "sign-up" && !passwordError && (
            <FieldDescription>
              {MIN_PASSWORD_LENGTH} caractères minimum.
            </FieldDescription>
          )}
          <FieldError>{passwordError}</FieldError>
        </Field>
        <Button type="submit" className="h-11 w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Spinner aria-label="Chargement" /> {copy.pending}
            </>
          ) : (
            copy.submit
          )}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {copy.switchPrompt}{" "}
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm"
          disabled={isPending}
          onClick={switchMode}
        >
          {copy.switchAction}
        </Button>
      </p>
    </Fragment>
  );
}
