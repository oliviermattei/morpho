import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";

let authInstance: NeonAuth | undefined;

// plan task 3: the SDK's cookie cache. getSession() trusts this cookie
// without contacting Neon as long as it's signed correctly and
// session_token is present (research, "getSession() — forme exacte du
// retour"). Declared explicitly rather than left to the SDK's own 300s
// default (research quotes it, but doesn't promise it stays that value) —
// this is also the number the plan's "Piège à garder en tête" warns every
// test and every manual check against: a revoked session can read as valid
// for up to this long.
const SESSION_DATA_TTL_SECONDS = 300;

/**
 * Lazily creates the Neon Auth instance. createNeonAuth() throws
 * synchronously when cookies.secret is missing or under 32 characters
 * (research, Trap 5) — calling it at module scope would break `npm run
 * build` locally whenever NEON_AUTH_COOKIE_SECRET isn't populated, not just
 * requests that need it.
 */
export function getAuth(): NeonAuth {
  if (!authInstance) {
    authInstance = createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL!,
      cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET!,
        // ADR 008: the SDK defaults to 'strict', which is not sent by the
        // browser on the top-level cross-site navigation a magic-link
        // click from a mail client is — the session exchange on return
        // would silently never happen.
        sameSite: "lax",
        sessionDataTtl: SESSION_DATA_TTL_SECONDS,
      },
      // Controlled rather than left to the SDK default: 'warn' surfaces
      // real auth-server problems without the request-level noise of a
      // more verbose level in a personal, low-traffic app.
      logLevel: "warn",
    });
  }
  return authInstance;
}
