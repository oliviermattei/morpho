/**
 * The auth screens' own paths, as constants rather than string literals
 * scattered across components.
 *
 * RESET_PASSWORD_PATH in particular is not just a link target: it is sent
 * to the auth server as `redirectTo` when a reset is requested, and the
 * route it names has to be the screen that consumes the `token` query
 * param. A typo there produces a mail whose link lands on a 404 — and the
 * token is single-use, so the user cannot simply retry the same link.
 */
export const SIGN_IN_PATH = "/auth/sign-in";
export const RESET_PASSWORD_PATH = "/auth/reset-password";
