import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly } from "serwist";
import type { RuntimeCaching } from "serwist";
import {
  CACHE_NAMES,
  isApiRequest,
  isDocumentRequest,
  isImmutableAsset,
  isRscRequest,
} from "./cache-policy";

/**
 * s10 plan task 4(b), decision 19: the real routing table — never
 * `defaultCache` (decision 2). Order matters: `/api/**` is checked
 * first so nothing downstream can ever shadow it. Every entry that
 * persists a response names its `cacheName` explicitly — the silent
 * default (`"serwist-runtime"`) is exactly what a future entry added
 * without one would fall back to, invisibly, outside `purgeUserCaches`'s
 * reach.
 */
export function buildRuntimeCaching(): RuntimeCaching[] {
  return [
    {
      matcher: ({ request }) => isApiRequest(request),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request }) => isRscRequest(request),
      handler: new NetworkFirst({
        cacheName: CACHE_NAMES.rsc,
        // RSC entries proliferate (Next 16 appends `?_rsc=<hash>`,
        // keyed on the router's own state tree) — a generous budget so
        // this cache doesn't evict the far more valuable documents
        // cache below by sharing a common one (decision 19).
        plugins: [new ExpirationPlugin({ maxEntries: 48 })],
      }),
    },
    {
      matcher: ({ request }) => isDocumentRequest(request),
      handler: new NetworkFirst({
        cacheName: CACHE_NAMES.documents,
        plugins: [new ExpirationPlugin({ maxEntries: 16 })],
      }),
    },
    {
      matcher: ({ request }) => isImmutableAsset(request),
      handler: new CacheFirst({
        cacheName: CACHE_NAMES.immutable,
      }),
    },
  ];
}
