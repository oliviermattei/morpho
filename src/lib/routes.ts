/**
 * The single source of every path this app's s06-scope components link
 * to (plan decision 8): `/saisie` (s03), `/profil` (s04), `/auth/sign-in`
 * (s02, constaté dans src/proxy.ts's LOGIN_URL). No component built or
 * rewritten by s06 writes a route as a string literal — src/lib/
 * routes.test.ts locks that each of these actually resolves to a real
 * page on disk, and a source scan (same test file's scope) locks that
 * nothing under src/app/(home)/**, AppHeader.tsx, BodyMap.tsx,
 * BodyMapLegend.tsx or OffBodyCards.tsx repeats the string instead of
 * importing this constant.
 *
 * `src/proxy.ts`'s own LOGIN_URL stays its property (s02, outside the
 * s06 scope) — this module doesn't replace it, it only stops s06 from
 * inventing a second spelling of the same path.
 */
export const routes = {
  entry: "/saisie",
  profile: "/profil",
  signIn: "/auth/sign-in",
  // s07 P11: named in English like the rest of this object's keys, even
  // though `graphes` is the French URL segment shown to the user.
  charts: "/graphes",
  // E1 (header menu blocker, resolved ahead of s09): the page already
  // exists (src/app/historique/page.tsx, s03) — this only gives it the
  // same single source of truth every other secondary route already has,
  // so AppHeader's menu never repeats the path as a string literal.
  history: "/historique",
  // s09 R1: a function, not a string constant — the only entry here that
  // takes an argument. src/lib/routes.test.ts treats it apart from the
  // string routes above rather than folding it into the same equality
  // check, and its own disk-existence assertion arrives with the page
  // itself (task 8), not here.
  sessionEdit: (id: string) => `/historique/${id}`,
  // ADR 020: the mandatory first screen. Reachable only by redirect from
  // the gate (src/lib/onboarding-gate.ts) — nothing in the interface
  // links to it, because a user who can see the interface has already
  // been through it.
  onboarding: "/onboarding",
} as const;
