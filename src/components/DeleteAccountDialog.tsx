"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { purgeUserCaches } from "@/lib/pwa/cache-policy";
import { routes } from "@/lib/routes";
import { RequiredFieldLabel } from "@/components/RequiredMark";

const WRONG_PASSWORD_MESSAGE = "Mot de passe incorrect.";
const PASSWORD_REQUIRED_MESSAGE =
  "Saisissez votre mot de passe pour confirmer.";
const DELETE_FAILURE_MESSAGE =
  "La suppression a échoué. Vérifiez votre connexion et réessayez.";
const PARTIAL_FAILURE_MESSAGE =
  "Vos données ont été supprimées, mais le compte n'a pas pu être fermé. Réessayez, ou déconnectez-vous et recommencez.";

/**
 * "Supprimer mon compte", the one irreversible action in the app.
 *
 * The ordering below is the whole design, and it is ordered by what a
 * failure at each step costs:
 *
 *   1. Verify the password by signing in with it. Nothing is destroyed
 *      yet, so a wrong password costs the user nothing but a message.
 *      This step exists precisely so step 2 is never reached on a
 *      mistyped password — `deleteUser` is the only call that can check
 *      a password, and by the time it has checked one it has also
 *      already deleted the account, which is too late to gate step 2 on.
 *   2. DELETE /api/account — erases every row this app stores. Runs
 *      while the session is still valid, because the route authenticates
 *      by cookie; after step 3 there is no session left to authorize it.
 *   3. deleteUser — closes the Neon Auth account itself.
 *
 * A failure at step 3 leaves an empty but live account, which is
 * recoverable and is what PARTIAL_FAILURE_MESSAGE names honestly. The
 * reverse order — closing the account first — would leave the app's rows
 * behind with no session that could ever reach them again.
 */
export function DeleteAccountDialog({ email }: { email: string }) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (password === "") {
      setFieldError(PASSWORD_REQUIRED_MESSAGE);
      return;
    }

    setDeleting(true);
    setFieldError(null);
    setOperationError(null);

    // ① Password check, non-destructive.
    try {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        setFieldError(WRONG_PASSWORD_MESSAGE);
        setDeleting(false);
        return;
      }
    } catch {
      // Same rejection-instead-of-tuple shape SignInScreen documents. A
      // failed sign-in here is overwhelmingly a wrong password; a
      // genuine outage surfaces at step 2 instead, where it is named.
      setFieldError(WRONG_PASSWORD_MESSAGE);
      setDeleting(false);
      return;
    }

    // ② The app's own data, while the session is still live.
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) {
        setOpen(false);
        setOperationError(DELETE_FAILURE_MESSAGE);
        setDeleting(false);
        return;
      }
    } catch {
      setOpen(false);
      setOperationError(DELETE_FAILURE_MESSAGE);
      setDeleting(false);
      return;
    }

    // ③ The auth account.
    let accountClosed = true;
    try {
      const { error } = await authClient.deleteUser({ password });
      if (error) accountClosed = false;
    } catch {
      accountClosed = false;
    }

    // The cached responses of an account that no longer exists must not
    // survive on the device — the same reasoning, and the same single
    // caller-side purge, as signing out (ADR 018).
    try {
      await purgeUserCaches(globalThis.caches);
    } catch (thrown) {
      console.error(
        "[delete-account] purgeUserCaches failed",
        thrown instanceof Error ? thrown.name : typeof thrown,
      );
    }

    if (!accountClosed) {
      setOpen(false);
      setOperationError(PARTIAL_FAILURE_MESSAGE);
      setDeleting(false);
      return;
    }

    // replace, never push: back navigation must not land on a screen
    // belonging to an account that no longer exists.
    router.replace(routes.signIn);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Supprimer votre compte efface définitivement vos sessions, vos
        mesures et votre profil. Cette action est irréversible et il n&apos;y
        a aucune sauvegarde.
      </p>

      {operationError && (
        <Alert variant="destructive">
          <AlertDescription>{operationError}</AlertDescription>
        </Alert>
      )}

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setPassword("");
            setFieldError(null);
          }
        }}
      >
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" className="h-11 w-full">
            Supprimer mon compte
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent
          ref={contentRef}
          // Focus opens on Annuler, the non-destructive default — the
          // same explicit override DeleteSessionDialog makes.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current
              ?.querySelector<HTMLButtonElement>(
                '[data-slot="alert-dialog-cancel"]',
              )
              ?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer votre compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes vos sessions, toutes vos mesures et votre profil seront
              définitivement supprimés, et votre compte {email} sera fermé.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Field data-invalid={fieldError ? true : undefined}>
            <RequiredFieldLabel htmlFor="deleteAccountPassword">
              Mot de passe
            </RequiredFieldLabel>
            <Input
              id="deleteAccountPassword"
              name="deleteAccountPassword"
              type="password"
              required
              autoComplete="current-password"
              className="h-11 text-base md:text-sm"
              aria-invalid={fieldError ? true : undefined}
              disabled={deleting}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (fieldError) setFieldError(null);
              }}
            />
            <FieldError>{fieldError}</FieldError>
          </Field>

          <AlertDialogFooter>
            <AlertDialogCancel className="h-11" disabled={deleting}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-11"
              disabled={deleting}
              onClick={(event) => {
                // preventDefault: the dialog must stay open through the
                // whole operation, and must not close on a refused
                // password — the field error is rendered inside it.
                event.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? "Suppression…" : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
