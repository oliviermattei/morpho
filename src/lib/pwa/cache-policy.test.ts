// @vitest-environment node
//
// s10 plan task 4(a). Pure functions — the cheapest, most decisive tests
// in the story (test strategy). No service worker, no CacheStorage: a
// stub stands in wherever the real global would be.
import { describe, expect, it } from "vitest";
import {
  CACHE_NAMES,
  USER_CACHE_PREFIX,
  isApiRequest,
  isDocumentRequest,
  isImmutableAsset,
  isRscRequest,
  purgeUserCaches,
  selectRuntimeCaching,
} from "./cache-policy";

function request(url: string, init?: RequestInit): Request {
  return new Request(`https://morpho.test${url}`, init);
}

describe("isApiRequest — decision 1a: no exception, /api/auth/** included", () => {
  it.each(["/api/health", "/api/session", "/api/auth/callback", "/api/sessions"])(
    "%s is an API request",
    (path) => {
      expect(isApiRequest(request(path))).toBe(true);
    },
  );

  it("a non-API path is not", () => {
    expect(isApiRequest(request("/historique"))).toBe(false);
  });
});

describe("isRscRequest — Next 16.2.12's own RSC_HEADER ('rsc', value '1')", () => {
  it("recognizes a request carrying the rsc: 1 header", () => {
    expect(isRscRequest(request("/graphes", { headers: { rsc: "1" } }))).toBe(
      true,
    );
  });

  // Headers.get is case-insensitive by spec — asserted here, not assumed.
  it("is indifferent to header-name casing", () => {
    expect(isRscRequest(request("/graphes", { headers: { RSC: "1" } }))).toBe(
      true,
    );
  });

  it("does not flag a request without the header", () => {
    expect(isRscRequest(request("/graphes"))).toBe(false);
  });
});

describe("isDocumentRequest", () => {
  it("recognizes a navigation request (mode: 'navigate')", () => {
    // The Fetch API constructor refuses `mode: "navigate"` (browsers
    // reject it as a RequestInit value) — a REAL navigation request only
    // ever arrives this way through an actual FetchEvent, never through
    // `new Request()`. A minimal double stands in, exactly like
    // src/lib/db/sessions.test.ts's mapMeasurementRows fixtures.
    const navigationRequest = {
      mode: "navigate",
      headers: new Headers(),
    } as unknown as Request;

    expect(isDocumentRequest(navigationRequest)).toBe(true);
  });

  it("does not flag an ordinary fetch (RSC, API, asset)", () => {
    expect(isDocumentRequest(request("/graphes"))).toBe(false);
  });
});

describe("isImmutableAsset", () => {
  it.each(["/_next/static/chunks/main.js", "/icons/icon-192.png"])(
    "%s is immutable",
    (path) => {
      expect(isImmutableAsset(request(path))).toBe(true);
    },
  );

  it("a document path is not", () => {
    expect(isImmutableAsset(request("/historique"))).toBe(false);
  });
});

// Decision 3: the ONLY thing that makes purgeUserCaches trustworthy is
// that it never touches anything outside the morpho-user- prefix —
// tested against a stub carrying one of each kind, per the plan's own
// description.
describe("purgeUserCaches", () => {
  function stubCacheStorage(names: string[]) {
    let current = [...names];
    const deleted: string[] = [];
    const stub = {
      keys: async () => current,
      delete: async (name: string) => {
        const existed = current.includes(name);
        current = current.filter((n) => n !== name);
        if (existed) deleted.push(name);
        return existed;
      },
    } as unknown as CacheStorage;
    return { stub, deleted: () => deleted };
  }

  it("deletes exactly the caches prefixed morpho-user-, never the precache or the immutable cache", async () => {
    const { stub, deleted } = stubCacheStorage([
      "morpho-user-documents",
      "morpho-user-rsc",
      CACHE_NAMES.immutable,
      "serwist-precache-v2-abc123",
    ]);

    await purgeUserCaches(stub);

    expect(deleted().sort()).toEqual(
      ["morpho-user-documents", "morpho-user-rsc"].sort(),
    );
  });

  it("does not throw when caches is absent (no global CacheStorage)", async () => {
    await expect(purgeUserCaches(undefined)).resolves.not.toThrow();
  });
});

describe("selectRuntimeCaching — decision 13, NODE_ENV only, never a hostname", () => {
  it("returns a single NetworkOnly catch-all outside production", () => {
    const table = selectRuntimeCaching("development");
    expect(table).toHaveLength(1);
    expect(table[0]?.handler.constructor.name).toBe("NetworkOnly");
  });

  it("also neutralizes on an undefined NODE_ENV", () => {
    const table = selectRuntimeCaching(undefined);
    expect(table).toHaveLength(1);
  });

  it("returns the full table in production", () => {
    const table = selectRuntimeCaching("production");
    expect(table.length).toBeGreaterThan(1);
  });
});

describe("USER_CACHE_PREFIX / CACHE_NAMES", () => {
  it("every user-data cache name starts with the prefix; the immutable one does not", () => {
    expect(CACHE_NAMES.documents.startsWith(USER_CACHE_PREFIX)).toBe(true);
    expect(CACHE_NAMES.rsc.startsWith(USER_CACHE_PREFIX)).toBe(true);
    expect(CACHE_NAMES.immutable.startsWith(USER_CACHE_PREFIX)).toBe(false);
  });
});
