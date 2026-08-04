import { ChangePasswordForm } from "./ChangePasswordForm";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "./ui/field";

/**
 * The account half of /profil: who you are signed in as, and the two
 * things you can do to that account.
 *
 * Server Component — it renders one string it was handed and delegates
 * the rest. The two "use client" islands below are exactly the two
 * operations that talk to the auth server; nothing else on this screen
 * needs to be client-side for them.
 *
 * The email is displayed, not edited. Changing it is a different
 * operation with a different failure mode (a verification round trip
 * through a mailbox), and ADR 019's whole point was that no mailbox is
 * involved in this app's auth — offering the field without being able
 * to complete the flow would be worse than not offering it.
 */
export function AccountSection({ email }: { email: string }) {
  return (
    <section className="flex flex-col gap-6">
      <FieldSet>
        <FieldLegend>Compte</FieldLegend>
        <Field>
          <FieldLabel asChild>
            <span id="account-email-label">Adresse email</span>
          </FieldLabel>
          <p
            aria-labelledby="account-email-label"
            className="flex h-11 items-center rounded-lg border border-border bg-muted/40 px-3 text-base break-all md:text-sm"
          >
            {email}
          </p>
          <FieldDescription>
            L&apos;adresse avec laquelle vous vous connectez.
          </FieldDescription>
        </Field>
      </FieldSet>

      <FieldSeparator />

      <ChangePasswordForm />

      <FieldSeparator />

      <FieldSet>
        <FieldLegend>Zone dangereuse</FieldLegend>
        <DeleteAccountDialog email={email} />
      </FieldSet>
    </section>
  );
}
