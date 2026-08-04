# ADR 018 — The service worker's cache keeps user data, and purges it on sign-out

- Status: accepted
- Date: 2026-08-03
- Scope: story s10

## Context

s10 needs the service worker to satisfy two acceptance criteria that pull in opposite
directions on the same data. Criterion 3: opened offline, the app must show its interface and
the **last known state** — not a blank shell. Criterion 7: the cache strategy must exclude API
responses carrying a user's data from anything shared or surviving sign-out — signing out, then
reopening offline, must expose nothing from the previous session.

Caching nothing satisfies criterion 7 trivially and fails criterion 3 outright: offline, the app
would show an empty shell with no data to read. Caching everything indefinitely (the shape
`@serwist/turbopack`'s own `defaultCache` produces — `GET /api/*` in a persistent `"apis"` cache
for 24 hours, HTML/RSC in `"pages"`/`"pages-rsc"`/`"others"`) satisfies criterion 3 and fails
criterion 7 by construction: sign out, go offline, reopen — the previous account's silhouette is
still there. The two criteria are only reconcilable by tying the cache's lifecycle to the
session's lifecycle, not by picking a fixed caching duration.

morpho is a single-account-per-device personal tool (`docs/architecture.md`): there is no
multi-account switching to support, only "signed in" and "signed out".

## Decision

**Three families of runtime caching**, written by hand in `src/lib/pwa/runtime-caching.ts` —
never `defaultCache`, guarded by a source-scan test:

1. `/api/**` (including `/api/auth/**`) → `NetworkOnly`. Never cached, no exception. This is
   where every user-data-carrying response actually lives.
2. Authenticated screens' HTML documents and RSC payloads → `NetworkFirst`, in two caches
   **prefixed `morpho-user-`** (`morpho-user-documents`, `morpho-user-rsc`) — this is what
   satisfies criterion 3: the last successfully rendered screen is what's replayed offline.
3. Immutable assets (`/_next/static/**`, `/icons/**`) → precache + `CacheFirst`, in a cache
   **outside** the `morpho-user-` prefix — nothing in this family ever carries a user's data, and
   it must never be purged by the mechanism below.

**Purge on sign-out**: `purgeUserCaches(caches)` (`src/lib/pwa/cache-policy.ts`) deletes every
cache whose name starts with `morpho-user-`, and only those — the precache is untouched by
construction (it doesn't carry the prefix). Called from
`src/components/auth/LogoutButton.tsx`'s `handleSignOut`, **before** `authClient.signOut()`, in
a `try/catch` that never blocks the sign-out itself. Purging first, not after: if `signOut()`
fails (e.g. offline), the user stays signed in with an empty cache — inert; the reverse would
leave a signed-out device still serving the previous account's data.

The prefix convention is what makes the invariant testable on the real objects `serwist`
constructs, not on a second copy of the same list: `buildRuntimeCaching()`'s test asserts, as a
closed allow-list, that every entry's `handler.cacheName` either starts with `morpho-user-` or is
exactly the one immutable-assets cache name — never left implicit (a `new NetworkFirst({})`
silently falls back to `"serwist-runtime"`, a name `purgeUserCaches` would never reach).

## Considered options

- **`defaultCache` as shipped** — rejected. Persistent cache of `GET /api/*` and authenticated
  HTML; fails criterion 7 by construction, demonstrated in three steps (sign out, go offline,
  reopen).
- **Cache only static assets, no data at all** — rejected. Satisfies criterion 7 trivially, but
  loses criterion 3 entirely: offline, the app shows an empty shell, never the last known state
  — exactly the "graph with bare axes" failure mode this project's design system exists to avoid
  elsewhere.
- **Partition cache names by user id** (e.g. `morpho-user-<uuid>-documents`) — rejected. It
  requires threading identity into the service worker's context (a message posted from the page,
  since a service worker has no session of its own), stores a user identifier in a cache name
  readable by any script on the origin, and doesn't even solve the stated problem: after signing
  out, the cache for that same account is still fully servable the next time they (or anyone with
  access to the device) sign back in — nothing forces re-population from the network.

## Consequences

Easier: the purge is one function, tested on a stubbed `CacheStorage` and asserted to run before
`signOut()` via a shared call-order array — no second mechanism to keep in sync with the runtime
caching table, since both read the same `USER_CACHE_PREFIX` constant
(`src/lib/pwa/cache-policy.ts`).

Harder: every new cache introduced later on this project must decide, explicitly, whether it can
ever carry user data — and if it can, it must carry the `morpho-user-` prefix or it silently
survives sign-out. There is no default that catches this automatically; it is enforced by the
closed allow-list test on `buildRuntimeCaching()`'s real output, not by convention alone.

To watch: this assumes a single account per device, matching the app's actual usage pattern
(`docs/architecture.md`). Multi-account support, if ever added, would need cache names threaded
with identity after all — a new decision, not a silent extension of this one.
