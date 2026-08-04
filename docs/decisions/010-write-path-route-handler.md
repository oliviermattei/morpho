# ADR 010 — A Route Handler, not a Server Action, for writing a session

- Status: accepted
- Date: 2026-08-03
- Scope: story s03

## Context

Research left this open (question 2): Next 16 documents two legitimate
server-side write paths — a Server Action (`useActionState`, field errors,
`refresh()`) and a Route Handler (`src/app/api/**/route.ts`). Both keep
the browser away from Postgres. The pull toward a Server Action was
`useActionState`'s built-in `pending` state and per-field error shape;
the pull toward a Route Handler was consistency with `docs/architecture.md`
(`src/app/api/`) and a request/response surface that's easy to test
directly with a `Request`, the pattern s01 already established for
`/api/health` and `/api/session`.

## Decision

`POST /api/sessions` (`src/app/api/sessions/route.ts`), called by `fetch`
from the client form (`src/components/MeasurementSessionForm.tsx`, task
7). On success, the client navigates to `/historique` — there is no
in-place re-render to drive with `useActionState`.

## Considered options

- **Server Action + `useActionState`** — rejected. Three reasons, all
  concrete rather than stylistic:
  1. The test motif for a Route Handler already exists in this repo: s01
     calls its handlers directly with a `Request`, no React test harness.
     `<form action={serverAction}>` plus `useActionState` in jsdom would
     depend on React DOM's action machinery, which is more fragile to
     drive from a test than a plain `onSubmit` + `fetch`.
  2. `refresh()` from `next/cache` — the mechanism a Server Action would
     use to update the UI in place — buys nothing here: success navigates
     to a different route (`/historique`), it doesn't re-render the form
     in place.
  3. Next's own docs are explicit that a Server Function **is** a public
     POST endpoint (`node_modules/next/dist/docs/01-app/01-getting-started/
     07-mutating-data.md`, WARNING box) — reachable directly, not only
     through the form. A Route Handler makes that surface visible as a
     named, testable endpoint instead of an implicit one, which serves
     criterion 7 (the cross-user isolation test targets this handler
     directly, the same way `src/app/api/sessions/route.test.ts`'s
     forgery test does).
- **Route Handler** — accepted, for the reasons above plus consistency
  with `docs/architecture.md`'s `src/app/api/` convention and the pattern
  s01 already used for `/api/health` and `/api/session`.

## Consequences

Easier: the write path is testable exactly like s01's handlers — call the
exported `POST` with a real `Request`, mock `@/lib/auth` and `@/lib/db`,
assert on the `Response`. The 401/503/400/201 taxonomy from
`src/app/api/session/route.ts` (research, ADR-adjacent) is reused as-is.

Harder: no `useActionState` `pending` boolean or field-error binding for
free — `src/components/MeasurementSessionForm.tsx` (task 7) manages
submitting state and per-field errors itself, from the JSON response
shape `{ fieldErrors, formErrors }` this route returns on 400.

To watch: identity is read exclusively from `getAuth().getSession()`
inside the handler — a `user_id` in the request body is never read. This
is asserted by `src/app/api/sessions/route.test.ts`'s forgery test: a
session for user B with `user_id: "user-a"` forged into the body still
creates a session owned by B.
