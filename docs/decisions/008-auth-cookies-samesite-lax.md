# ADR 008 — `sameSite: 'lax'` for the session cookies

- Status: accepted
- Date: 2026-08-02
- Scope: story s02

## Context

`@neondatabase/auth`'s `cookies.sameSite` option defaults to `'strict'`
(`node_modules/@neondatabase/auth/dist/next/server/index.d.mts:93`), and its
JSDoc notes that `'lax'` was the package's "previous hard-coded behavior" —
`'strict'` is a recent, opt-out default, not a long-standing one.

The magic link is delivered by email and clicked from a mail client. That
click is a top-level, cross-site navigation into the app (the referring
context is the mail client, not `morpho`'s own origin). A `SameSite=Strict`
cookie is not sent by the browser on that kind of navigation.

The session exchange on return (research, § "Échange de session au retour
du lien") depends on the challenge cookie
(`__Secure-neon-auth.session_challange`) being present on that first
request: `needsSessionVerification(request)` checks for both the
`neon_auth_session_verifier` query parameter and that cookie
(`dist/next/server/index.mjs:1392-1398`). If the challenge cookie is
`Strict`, the browser withholds it on the cross-site click, the SDK's
`needsSessionVerification` returns `false`, and the session never
materializes — silently: no error, just a visitor who clicked a valid link
and stayed logged out.

This is not fully verifiable from this environment (no reachable Neon Auth
instance — research, Blockers), so the choice below is not staked on
"strict fails, we tested it" but on what the SDK's own code and cookie
semantics establish, plus a package default it is not obligated to
represent morpho's use case.

## Decision

Set `cookies.sameSite: 'lax'` explicitly in `src/lib/auth.ts`, overriding
the SDK's default.

## Considered options

- **Leave `cookies.sameSite` unset (SDK default `'strict'`)** — rejected.
  Cross-site top-level navigations (the email click) do not attach `Strict`
  cookies; the specific mechanism the SDK uses to complete a magic-link
  sign-in structurally depends on a cookie surviving exactly the kind of
  navigation `Strict` is designed to block. Shipping the default here would
  produce a login flow that looks correct in every unit and component test
  (none of which drive a real cross-site navigation) and silently fails the
  one path the story exists for.
- **`sameSite: 'none'`** — rejected. Weaker than needed: `'none'` also
  permits the cookie on cross-site *sub-resource* requests (images,
  iframes, fetches embedded in third-party pages), which this app has no
  use for and which widens the CSRF surface for no benefit. `'lax'` already
  covers the one case that matters — a top-level GET navigation — without
  that extra exposure.
- **`sameSite: 'lax'`** — accepted. Sent on top-level navigations
  (including the cross-site email click) while still withheld on embedded
  cross-site requests. It is also, per the SDK's own JSDoc, the package's
  historical hard-coded behavior — not a novel or unsupported combination.

## Consequences

Easier: the magic-link return trip works the way the flow is designed to
work — the challenge cookie survives the click, `needsSessionVerification`
returns `true`, and the session gets exchanged.

Harder / to watch: `'lax'` is a deliberate, documented weakening relative
to the SDK's new default, so it must not be copied to a future cookie that
doesn't have this specific cross-site-navigation requirement without
re-deriving the same reasoning. `secure: true` stays forced by the SDK
regardless (research, § Cookies) — `'lax'` does not relax the
HTTPS-only requirement.

This is asserted by test in `src/lib/auth.test.ts` (task 3): the
`cookies.sameSite` value the app passes to `createNeonAuth()` is `'lax'`,
not the SDK default. It cannot be exercised end-to-end without a real Neon
Auth instance and mailbox — the manual protocol for that is task 8's job.
