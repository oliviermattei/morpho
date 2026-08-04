import { createSerwistRoute } from "@serwist/turbopack";
import { resolveRevision } from "@/lib/pwa/build-id";

/**
 * s10 plan task 5: the Route Handler that bundles and serves
 * `src/app/sw.ts` — the Turbopack-compatible replacement for the
 * webpack-only `@serwist/next` plugin (ADR 007). `swDest` is
 * deliberately absent: this route serves the built files directly, it
 * never writes one to disk.
 *
 * `revision` (task 5, trap 7): sourced from `resolveRevision`, never a
 * shelled-out `git` call — see src/lib/pwa/build-id.ts. Shared with the
 * version marker (task 7) so the two never drift.
 *
 * `esbuildOptions.define` (decision 13): explicit, not esbuild's own
 * automatic `NODE_ENV` substitution — that one is indexed on `minify`,
 * which `esbuildOptions` can silently flip. `define` is confirmed inside
 * `SUPPORTED_ESBUILD_OPTIONS` (@serwist/turbopack@9.5.12,
 * src/lib/constants.ts) and merged BEFORE the injection point
 * (src/lib/build.ts:17-20), so it is never overwritten by the library's
 * own manifest injection.
 */
const revision = resolveRevision(process.env);

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
    additionalPrecacheEntries: [{ url: "/~offline", revision }],
    esbuildOptions: {
      define: {
        "process.env.NODE_ENV": JSON.stringify(
          process.env.NODE_ENV === "development" ? "development" : "production",
        ),
      },
    },
  });
