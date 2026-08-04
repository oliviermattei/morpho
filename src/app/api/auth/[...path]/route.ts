import { getAuth } from "@/lib/auth";

type AuthRouteContext = { params: Promise<{ path: string[] }> };

// plan task 4: the SDK's own catch-all handler for every /api/auth/**
// request (sign-in, magic-link send, session refresh, sign-out…) — GET and
// POST are the two verbs the magic-link flow actually uses (research,
// "Handler d'API"). `params` is a Promise in Next 16
// (node_modules/next/dist/docs/.../route.md:87), which is exactly what
// authApiHandler()'s GET/POST already expect.
//
// Deliberately NOT `export const { GET, POST } = getAuth().handler()` at
// module scope, despite that being the SDK's own documented example
// (dist/next/server/index.mjs:1698-1701): calling getAuth() there defeats
// its own laziness (src/lib/auth.ts) — reproduced empirically, this breaks
// `next build` without secrets ("Missing required config: cookies.secret")
// during Next's "Collecting page data" phase, which imports every route
// module. Same invariant as src/lib/db/index.ts's getSql()/getDb(): call
// the lazy accessor per request, never at module scope.
export async function GET(request: Request, context: AuthRouteContext) {
  return getAuth().handler().GET(request, context);
}

export async function POST(request: Request, context: AuthRouteContext) {
  return getAuth().handler().POST(request, context);
}
