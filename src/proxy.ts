import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/auth";

const LOGIN_URL = "/auth/sign-in";

// plan task 5: auth.middleware() redirects (307) to LOGIN_URL, it never
// returns 401 (research Trap 2 / ADR 003) — that's exactly why /api/health
// and /api/session (s01's protected route) must stay excluded from
// `config.matcher` below: running this proxy on them would turn s01
// acceptance criterion 6's 401 into an HTML redirect. /auth/callback stays
// included: it's where the SDK's session-verification exchange runs
// (research, "Échange de session au retour du lien") — without it in the
// matcher, the cookies from a clicked magic link never get set.
//
// getAuth() is called here, inside the exported function, not at module
// scope: the same build-safety invariant as
// src/app/api/auth/[...path]/route.ts — constructing it eagerly breaks
// `next build` without secrets (reproduced empirically there).
export default function proxy(request: NextRequest) {
  return getAuth().middleware({ loginUrl: LOGIN_URL })(request);
}

export const config = {
  matcher: [
    // Exclude static assets (cost — research Trap 15, not correctness) and
    // every /api/** route except /api/auth (correctness — research Trap 2):
    // the middleware's only failure mode on a protected route is a
    // redirect, which would break s01's 401 contract on /api/health and
    // /api/session.
    //
    // s10 plan task 6, trap 5: four more exclusions, extended (not
    // duplicated) in this same negative lookahead. The proxy's only
    // sanction is an HTML redirect — on /serwist/sw.js that's an invalid
    // script and a SILENT service-worker registration failure; on
    // /manifest.webmanifest it breaks installability outright.
    // /manifest.webmanifest, /serwist/**, /icons/** and /~offline must
    // all stay reachable without a session.
    //
    // ADR 020 adds /silhouettes/** for the SAME reason, and it was a
    // real 307 in production before this line existed: the home
    // screen's drawing is served to an <img>, and an HTML redirect in
    // an <img> is a broken image, not a login prompt. It is also in the
    // precache glob (public/**/*), so a service worker installing on a
    // cold session would have cached the redirect instead of the SVG.
    // Nothing about a body outline is private.
    //
    // /auth/reset-password is excluded for a reason of the same kind, and
    // it was verified as a real 307 before this exclusion existed: the
    // whole point of that screen is that it is reached WITHOUT a session,
    // from a link in a mail. The middleware only knows about `loginUrl`
    // (/auth/sign-in), which it lets through to avoid a redirect loop —
    // there is no publicPaths option to declare a second one, so the
    // matcher is the only place to say it.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|serwist|icons|silhouettes|~offline|auth/reset-password|api/(?!auth)).*)",
  ],
};
