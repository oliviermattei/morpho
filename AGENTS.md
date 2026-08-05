<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

The changes that bite in this project: `middleware.ts` is renamed **`proxy.ts`**; the Request APIs (`cookies()`, `headers()`, `params`) are **async**; Turbopack is the default bundler; `next lint` is removed in favour of calling `eslint` directly.

# morpho

Personal PWA for tracking weight and body measurements. See `docs/architecture.md` for the full architecture and `docs/decisions/` for why each choice was made.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui (base radix, preset radix-nova, lucide) · Neon Postgres via Drizzle · Neon Auth, email + mot de passe (**beta**) · Zod · Recharts (charts) · Serwist (PWA) · Vitest + Testing Library · Playwright.

## Rules that override convenience

- **The browser never talks to Postgres.** Every read and write goes through a Server Component or a route handler. Never prefix a database or auth secret with `NEXT_PUBLIC_`. There is no RLS to catch a mistake — isolation lives entirely in this code.
- **Identity comes from `auth.getSession()`**, never from a `user_id` sent by the client. A handler that accepts an identifier as a parameter is a security bug, not a shortcut.
- **Validate every payload with Zod on the server**, even when the client already did. Physiological ranges are declared per measurement `kind`, in one place.
- **Empty is not zero.** An unfilled field produces no `measurements` row; it never becomes `0`. Read Drizzle `numeric` columns as numbers, not strings — a value arriving as `"72.40"` silently breaks deltas and chart axes.
- **`src/components/ui/` is generated** by the shadcn CLI. Compose above it in `src/components/`; never hand-edit it.
- **No hard-coded colors.** Values come from the design system tokens in `src/app/globals.css`.
- **The `neon_auth` schema belongs to Neon Auth.** Drizzle manages `public` only (`schemaFilter` in `drizzle.config.ts`). No migration may touch `neon_auth`.
- **Never install `@vitejs/plugin-react`** — it pulls `@babel/core@8.0.0-rc` and conflicts with `shadcn`. Vitest transpiles JSX through esbuild using `jsx: "react-jsx"`.
- Server Components by default; `"use client"` only where interactivity requires it.

## Layout

```
docs/          prd, stories, architecture, decisions (ADRs), plans, reviews
drizzle/       generated SQL migrations — versioned, never hand-edited
src/app/       routes, layouts, route handlers (api/)
src/components/    app components · ui/ = generated shadcn primitives
src/lib/       db/ (Neon client + schema.ts) · auth.ts · onboarding*.ts · utils.ts
public/silhouettes/  homme.svg, femme.svg — the home screen's drawing (ADR 020)
tests/e2e/     Playwright specs
```

## Commands

```
npm run dev
npm run check        # typecheck + lint + test — what the review runs
npm run test:e2e     # needs npx playwright install once
npm run db:generate  # then npm run db:migrate
```

Set `E2E_EMAIL` and `E2E_PASSWORD` in `.env.local` (a real account on the Neon Auth project) and `npm run test:e2e` also runs the session-dependent specs — `*.auth.spec.ts`, against a session opened for real by `tests/e2e/auth.setup.ts`. Without them, only the anonymous suite runs. See [ADR 019](docs/decisions/019-email-password-replaces-magic-link.md).

## ADR numbering

ADRs are immutable and referenced by number. Numbers already taken are listed below; never reuse or renumber one.

| Range | Owner |
|---|---|
| 001–007 | framing (stack, database, auth, data model, tests, deployment, PWA) |
| 008 | s02 — session cookies `sameSite: 'lax'` |
| 009–010 | s03 — test database, write path |
| 011 | framing — Playwright session via the verification table |
| 012–018 | s05–s10 |
| 019 | framing — email + password replaces the magic link |
| 020 | framing — redesign: drawn silhouette, bottom nav, mandatory onboarding |
| 021+ | free — take the next unused number. |

## Naming & language

Component files PascalCase, `lib` modules kebab-case, tables and columns snake_case, TypeScript types derived from the Drizzle schema rather than redeclared. UI text in French; code, table names, comments and commit messages in English.
