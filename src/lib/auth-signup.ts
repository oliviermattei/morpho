/**
 * Whether this deployment accepts new accounts.
 *
 * morpho is a single-person app: once the account exists, an open
 * registration form is a door for strangers, not a feature. But "closed"
 * has to be reversible without a code change — hence an environment
 * variable rather than a deleted branch.
 *
 * Closed by default. An unset variable on a fresh deployment must not
 * silently open registration, so only the exact string "true" opens it;
 * anything else — unset, empty, "1", "yes", a typo — keeps it shut. The
 * one moment it needs to be "true" is the very first boot, to create the
 * account; after that it can go back to unset.
 *
 * NOT prefixed with NEXT_PUBLIC_. The browser learns the answer through a
 * prop passed down from the sign-in Server Component, and the value is
 * read again server-side in the auth route handler — the UI gate alone
 * would be cosmetic, since POST /api/auth/sign-up/email is reachable
 * without ever loading the screen.
 *
 * Read per call, never captured in a module-scope constant: on Vercel the
 * variable can change between deployments without a rebuild, and a
 * constant evaluated at import time would freeze whatever value the build
 * happened to see.
 */
export function isSignUpEnabled(): boolean {
  return process.env.SIGNUP_ENABLED === "true";
}
