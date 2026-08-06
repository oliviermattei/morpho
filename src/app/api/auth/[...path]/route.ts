import { getAuth } from "@/lib/auth";
import { isSignUpEnabled } from "@/lib/auth-signup";

type AuthRouteContext = { params: Promise<{ path: string[] }> };

// The registration endpoint, as the SDK's catch-all sees it: POST
// /api/auth/sign-up/email arrives here as ["sign-up", "email"].
const SIGN_UP_PATH = ["sign-up", "email"];

function isSignUpRequest(path: string[]): boolean {
  return (
    path.length === SIGN_UP_PATH.length &&
    path.every((segment, index) => segment === SIGN_UP_PATH[index])
  );
}

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

// SIGNUP_ENABLED is enforced HERE, not only in the screen that hides the
// form: /api/auth/sign-up/email is a public endpoint reachable with a
// single curl, so a UI-only gate would close the door and leave the window
// open. The `params` promise is awaited before the check rather than
// handed straight to the SDK — this is the one place that needs to know
// which endpoint was asked for.
export async function POST(request: Request, context: AuthRouteContext) {
  const { path } = await context.params;

  if (isSignUpRequest(path) && !isSignUpEnabled()) {
    return Response.json(
      {
        code: "SIGNUP_DISABLED",
        message: "Account creation is disabled on this deployment.",
      },
      { status: 403 },
    );
  }

  // `context` is forwarded untouched, not rebuilt around the `path` read
  // above: a promise can be awaited any number of times, and the SDK's
  // handler must receive exactly the object Next handed us.
  return getAuth().handler().POST(request, context);
}
