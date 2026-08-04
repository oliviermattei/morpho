import { MIN_PASSWORD_LENGTH } from "@/lib/password";

export const NETWORK_FAILURE_MESSAGE =
  "Vérifiez votre connexion et réessayez.";

const WRONG_CREDENTIALS_MESSAGE = "Email ou mot de passe incorrect.";
const ACCOUNT_TAKEN_MESSAGE = "Un compte existe déjà avec cette adresse email.";
const EXPIRED_LINK_MESSAGE =
  "Ce lien de réinitialisation a expiré ou a déjà été utilisé. Demandez-en un nouveau.";
const WEAK_PASSWORD_MESSAGE = `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`;

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
export const ERROR_MESSAGES: Record<string, string> = {
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
  weak_password: WEAK_PASSWORD_MESSAGE,
  validation_failed: "Vérifiez les informations saisies.",
  over_request_rate_limit:
    "Trop de tentatives. Réessayez dans quelques minutes.",
  session_expired: "Votre session a expiré. Reconnectez-vous.",
  session_not_found: "Votre session a expiré. Reconnectez-vous.",
  // Password reset. The token is single-use and short-lived, so "expired"
  // and "already used" are the same dead end for the user and get the same
  // sentence — the only useful next step is to ask for another link.
  invalid_token: EXPIRED_LINK_MESSAGE,
  token_expired: EXPIRED_LINK_MESSAGE,
  // Better Auth raw codes, in case a call resolves with `{ error }`
  // instead of rejecting
  INVALID_EMAIL_OR_PASSWORD: WRONG_CREDENTIALS_MESSAGE,
  USER_ALREADY_EXISTS: ACCOUNT_TAKEN_MESSAGE,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: ACCOUNT_TAKEN_MESSAGE,
  PASSWORD_TOO_SHORT: WEAK_PASSWORD_MESSAGE,
  PASSWORD_TOO_LONG: "Ce mot de passe est trop long.",
  EMAIL_NOT_VERIFIED: "Cette adresse email n'est pas encore vérifiée.",
  CREDENTIAL_ACCOUNT_NOT_FOUND: WRONG_CREDENTIALS_MESSAGE,
  INVALID_TOKEN: EXPIRED_LINK_MESSAGE,
  TOKEN_EXPIRED: EXPIRED_LINK_MESSAGE,
};

/**
 * Digs the Better Auth error code out of whatever the SDK rejected with.
 * A rejected sign-in surfaces as an APIError whose code sits either on the
 * object itself or one level down under `body`/`error`; a genuine network
 * failure rejects with a plain TypeError and no code at all, which maps to
 * the retry message.
 */
export function readErrorCode(thrown: unknown): { code?: string } {
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

/**
 * The French sentence for a code, or the retry message for an unknown one.
 *
 * `overrides` lets a screen re-read a code that means something specific in
 * its own context — see RESET_ERROR_MESSAGES.
 */
export function messageForCode(
  code: string | undefined,
  overrides?: Record<string, string>,
): string {
  if (!code) return NETWORK_FAILURE_MESSAGE;
  return overrides?.[code] ?? ERROR_MESSAGES[code] ?? NETWORK_FAILURE_MESSAGE;
}

/**
 * Codes as they arrive on the reset screen, which are NOT the ones the auth
 * server sends. Verified in a real browser against the live server: a dead
 * reset token gets a `400 {"code":"INVALID_TOKEN"}` from the auth server,
 * and the SDK hands the app an `AuthApiError` with `status: 401` and
 * `code: "bad_jwt"` — its taxonomy for "the token you presented is not
 * usable", the same code a rotten *session* cookie would produce. The
 * generic sentence for that code ("Vérifiez votre connexion") sent the user
 * to check their network for a problem that was really an expired link, so
 * this screen reads it as what it is here.
 */
export const RESET_ERROR_MESSAGES: Record<string, string> = {
  bad_jwt: EXPIRED_LINK_MESSAGE,
  invalid_token: EXPIRED_LINK_MESSAGE,
  INVALID_TOKEN: EXPIRED_LINK_MESSAGE,
};
