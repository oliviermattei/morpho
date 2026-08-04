import { NetworkOnly } from "serwist";
import type { RuntimeCaching } from "serwist";
import { buildRuntimeCaching } from "./runtime-caching";

/**
 * s10 plan task 4(a), ADR 018: every cache that can carry a response
 * with a user's data MUST carry this prefix — it's the only thing that
 * makes `purgeUserCaches` below trustworthy. The precache and the
 * immutable-assets cache never carry it, and never contain user data.
 */
export const USER_CACHE_PREFIX = "morpho-user-";

export const CACHE_NAMES = {
  documents: `${USER_CACHE_PREFIX}documents`,
  rsc: `${USER_CACHE_PREFIX}rsc`,
  immutable: "morpho-immutable",
} as const;

/**
 * Decision 1a: every `/api/**` request, including `/api/auth/**` — no
 * exception. This is where every user-data-carrying response actually
 * lives; it is never cached (NetworkOnly, task 4b).
 */
export function isApiRequest(request: Request): boolean {
  return new URL(request.url).pathname.startsWith("/api/");
}

/**
 * Next 16.2.12's own RSC_HEADER constant
 * (client/components/app-router-headers.js: `const RSC_HEADER = 'rsc'`),
 * set to `'1'` on every client-side navigation fetch
 * (router-reducer/fetch-server-response.js). `Headers.get` is
 * case-insensitive by spec — no extra normalization needed.
 */
export function isRscRequest(request: Request): boolean {
  return request.headers.get("rsc") === "1";
}

/**
 * A real top-level navigation — the Service Worker spec guarantees
 * `request.mode === "navigate"` on the FetchEvent's own request for
 * these (MDN, Service Worker API). Distinct from an RSC fetch, which
 * uses `fetch()` client-side and never carries this mode.
 */
export function isDocumentRequest(request: Request): boolean {
  return request.mode === "navigate";
}

/**
 * Assets that never change post-build: hashed static chunks and the PWA
 * icons. Never carries user data — outside the morpho-user- prefix by
 * design (ADR 018), and never purged on sign-out.
 */
export function isImmutableAsset(request: Request): boolean {
  const { pathname } = new URL(request.url);
  return (
    pathname.startsWith("/_next/static/") || pathname.startsWith("/icons/")
  );
}

/**
 * ADR 018, decision 3: deletes EXACTLY the caches whose name starts with
 * `USER_CACHE_PREFIX` — never the precache, never the immutable-assets
 * cache. Never throws when `caches` is unavailable (defensive: this is
 * called from a page context, `src/components/auth/LogoutButton.tsx`,
 * inside a try/catch that must never block sign-out — see the caller).
 */
export async function purgeUserCaches(
  cacheStorage: CacheStorage | undefined,
): Promise<void> {
  if (!cacheStorage) return;
  const names = await cacheStorage.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith(USER_CACHE_PREFIX))
      .map((name) => cacheStorage.delete(name)),
  );
}

/**
 * Decision 13: neutralized OUTSIDE production, by `NODE_ENV` — never by
 * hostname (the first draft's `isDevOrigin` would have neutralized
 * exactly the host the offline e2e spec runs on, task 9). Substituted at
 * bundle time via `esbuildOptions.define` (task 5's route), so this
 * function itself never reads `process.env` — it only branches on the
 * value it's handed.
 */
export function selectRuntimeCaching(
  nodeEnv: string | undefined,
): RuntimeCaching[] {
  if (nodeEnv !== "production") {
    return [{ matcher: /.*/i, handler: new NetworkOnly() }];
  }
  return buildRuntimeCaching();
}
