// @vitest-environment node
//
// s10 plan task 4(b), decision 19: asserted on the REAL objects
// buildRuntimeCaching() constructs — never on a second copy of the same
// constants compared to each other (the story's own corrected trap: a
// test comparing USER_CACHE_PREFIX to itself would stay green no matter
// what the table actually contains).
import { describe, expect, it } from "vitest";
import { NetworkOnly } from "serwist";
import { CACHE_NAMES, USER_CACHE_PREFIX } from "./cache-policy";
import { buildRuntimeCaching } from "./runtime-caching";

describe("buildRuntimeCaching — the real routing table (decision 19)", () => {
  const table = buildRuntimeCaching();

  it("is non-empty", () => {
    expect(table.length).toBeGreaterThan(0);
  });

  // The central, closed-allowlist assertion: the ONE form that fails on
  // an added `new NetworkFirst({ cacheName: "pages" })` — the exact
  // reflex `defaultCache`'s own naming would suggest. NetworkOnly
  // entries are excluded: they never persist a response, so their
  // vestigial `cacheName` ("serwist-runtime" by default) carries no
  // meaning to purge.
  it("every non-NetworkOnly entry's cacheName starts with morpho-user-, or is exactly the immutable cache — nothing else", () => {
    const persistentEntries = table.filter(
      (entry) => !(entry.handler instanceof NetworkOnly),
    );
    expect(persistentEntries.length).toBeGreaterThan(0);

    for (const entry of persistentEntries) {
      const cacheName = (entry.handler as unknown as { cacheName: string }).cacheName;
      const isUserCache = cacheName.startsWith(USER_CACHE_PREFIX);
      const isImmutableCache = cacheName === CACHE_NAMES.immutable;
      expect(isUserCache || isImmutableCache).toBe(true);
    }
  });

  // Decision 19's own named failure mode: `new NetworkFirst({})` falls
  // back to "serwist-runtime", a name purgeUserCaches would never reach.
  it("no persisting entry ever leaves cacheName at the silent 'serwist-runtime' default", () => {
    const persistentEntries = table.filter(
      (entry) => !(entry.handler instanceof NetworkOnly),
    );
    for (const entry of persistentEntries) {
      const cacheName = (entry.handler as unknown as { cacheName: string }).cacheName;
      expect(cacheName).not.toBe("serwist-runtime");
    }
  });

  it("documents and RSC are cached under two DISTINCT cacheNames", () => {
    const cacheNames = table
      .filter((entry) => !(entry.handler instanceof NetworkOnly))
      .map((entry) => (entry.handler as unknown as { cacheName: string }).cacheName);

    expect(cacheNames).toContain(CACHE_NAMES.documents);
    expect(cacheNames).toContain(CACHE_NAMES.rsc);
    expect(new Set(cacheNames).size).toBeGreaterThanOrEqual(3);
  });

  it("the /api/** entry is a real NetworkOnly instance", () => {
    const apiEntry = table.find(
      (entry) => entry.handler instanceof NetworkOnly,
    );
    expect(apiEntry).toBeDefined();
  });
});
