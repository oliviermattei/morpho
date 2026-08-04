"use client";

import { Fragment, type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck, TriangleAlert } from "lucide-react";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { RESET_PASSWORD_PATH } from "@/lib/auth-routes";
import { messageForCode, readErrorCode } from "@/lib/auth-errors";
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
import { RequiredFieldLabel } from "@/components/RequiredMark";

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

type Mode = "sign-in" | "sign-up" | "forgot";

const COPY: Record<
  Mode,
  {
    title: string;
    subtitle: string;
    submit: string;
    pending: string;
    switchPrompt: string;
    switchAction: string;
    switchTo: Mode;
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
    switchTo: "sign-up",
    failureTitle: "La connexion a échoué",
  },
  "sign-up": {
    title: "Créer un compte",
    subtitle: "Choisissez un email et un mot de passe.",
    submit: "Créer le compte",
    pending: "Création…",
    switchPrompt: "Vous avez déjà un compte ?",
    switchAction: "Se connecter",
    switchTo: "sign-in",
    failureTitle: "La création du compte a échoué",
  },
  forgot: {
    title: "Mot de passe oublié",
    subtitle: "Entrez votre email : vous recevrez un lien de réinitialisation.",
    submit: "Envoyer le lien",
    pending: "Envoi…",
    switchPrompt: "Vous vous en souvenez ?",
    switchAction: "Se connecter",
    switchTo: "sign-in",
    failureTitle: "L'envoi a échoué",
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
  const [resetLinkSent, setResetLinkSent] = useState(false);

  const copy = COPY[mode];

  function goToMode(next: Mode) {
    setMode(next);
    setEmailError(null);
    setPasswordError(null);
    setOperationError(null);
    setResetLinkSent(false);
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
          : mode === "forgot"
            ? await authClient.requestPasswordReset({
                email: validEmail,
                // Where the link in the mail lands. The auth server
                // consumes its own /reset-password/<token> URL first and
                // redirects here with `?token=`, so this must be the screen
                // that asks for the new password, not the sign-in screen.
                redirectTo: `${window.location.origin}${RESET_PASSWORD_PATH}`,
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
      setOperationError(messageForCode(error.code));
      setIsPending(false);
      return;
    }

    // Nothing to navigate to: no session was opened. The server answers the
    // same way whether or not the address has an account — deliberately, so
    // the screen cannot be used to test which addresses exist — so the
    // confirmation says "if an account exists" rather than promising a mail.
    if (mode === "forgot") {
      setResetLinkSent(true);
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
    // The reset request carries no password — the whole point is that the
    // user does not have one to give. Validating the empty field would
    // refuse a form that is complete.
    const needsPassword = mode !== "forgot";
    const parsedPassword = passwordSchema.safeParse(password);

    setEmailError(
      parsedEmail.success
        ? null
        : (parsedEmail.error.issues[0]?.message ??
            "Cette adresse email n'est pas valide."),
    );
    setPasswordError(
      !needsPassword || parsedPassword.success
        ? null
        : (parsedPassword.error.issues[0]?.message ??
            `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`),
    );

    const passwordRefused = needsPassword && !parsedPassword.success;
    if (!parsedEmail.success || passwordRefused) {
      // Both fields are above the fold on this screen, so the scroll is
      // usually a no-op — the focus is the point: the refused field is
      // where the caret lands, so correcting it takes no aiming.
      focusFirstInvalidField(["email", "password"], (fieldId) =>
        fieldId === "email" ? !parsedEmail.success : passwordRefused,
      );
      return;
    }

    void submit(
      parsedEmail.data,
      parsedPassword.success ? parsedPassword.data : "",
    );
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
        {resetLinkSent && (
          <Alert>
            <MailCheck />
            <AlertTitle>Vérifiez votre boîte mail</AlertTitle>
            <AlertDescription>
              Si un compte existe pour {email}, un lien de réinitialisation
              vient d&apos;y être envoyé. Il n&apos;est valable qu&apos;une
              fois.
            </AlertDescription>
          </Alert>
        )}
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
        {mode !== "forgot" && (
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
        )}
        {mode === "sign-in" && (
          // Under the field it rescues, not at the bottom of the screen: the
          // user reaches for it at the moment the password fails them. It
          // sits OUTSIDE the Field on purpose — `orientation="vertical"`
          // stretches every direct child to w-full (ui/field.tsx), which
          // would centre this link across the whole form.
          <div className="-mt-1 flex justify-end">
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-sm font-normal text-muted-foreground"
              disabled={isPending}
              onClick={() => goToMode("forgot")}
            >
              Mot de passe oublié ?
            </Button>
          </div>
        )}
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
          onClick={() => goToMode(copy.switchTo)}
        >
          {copy.switchAction}
        </Button>
      </p>
    </Fragment>
  );
}
