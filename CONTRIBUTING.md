# Contributing to morpho

Thanks for taking the time to contribute! This document explains how the
project is built, how to set it up, and how to get a change merged.

By participating you agree to abide by our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Table of contents

- [How this repo works](#how-this-repo-works)
- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [Project layout](#project-layout)
- [Coding conventions](#coding-conventions)
- [Non-negotiable rules](#non-negotiable-rules)
- [Commit messages](#commit-messages)
- [Pull requests](#pull-requests)

## How this repo works

morpho is built **spec-first**. A feature travels through
`docs/prd.md` → `docs/stories.md` → `docs/plans/<story-id>.md` → code →
`docs/reviews/`. A plan is implemented only once it says `validated: yes`, and
architectural choices are recorded as ADRs in `docs/decisions/`.

You do not have to write a full plan for a typo fix or a docs correction. But
for anything that changes behaviour, **open an issue first** and describe the
intent; a maintainer will tell you whether it needs a story and a plan. A large
PR that arrives with no agreed spec is likely to need reworking, which is
nobody's idea of fun.

ADR numbers are allocated centrally (see the table in `AGENTS.md`) — claim
yours in the issue before writing, so parallel work doesn't collide.

## Ways to contribute

- **Report a bug** — open a [bug report](https://github.com/oliviermattei/morpho/issues/new?template=bug_report.yml).
- **Request a feature** — open a [feature request](https://github.com/oliviermattei/morpho/issues/new?template=feature_request.yml).
- **Improve docs** — typo fixes and clarifications are always welcome, no
  ceremony needed.
- **Send code** — comment on an open issue first so we don't duplicate work.

Areas that would land well today: additional silhouette variants, extra
measurement kinds, CSV/JSON export, and i18n (the UI is French-only).

## Development setup

### Prerequisites

- **Node 20+**
- A **Neon** project with **Neon Auth** enabled (free tier is enough)

### Run

```bash
npm install
cp .env.example .env.local     # then fill DATABASE_URL + the two NEON_AUTH_* vars
npm run db:migrate
npm run dev                    # http://localhost:3000
```

### Checks before you push

```bash
npm run check                  # typecheck + eslint + vitest
npm run test:e2e               # Playwright — npx playwright install once
```

CI runs `npm run check` on every pull request, so running it locally saves a
round-trip. E2E tests are not run in CI (they need a live Neon project); run
them locally when you touch a user-facing flow.

Database schema changes:

```bash
npm run db:generate            # writes a new SQL file under drizzle/
npm run db:migrate
```

Never hand-edit a generated migration, and never let a migration touch the
`neon_auth` schema — Drizzle manages `public` only.

## Project layout

```
docs/          prd, stories, architecture, decisions (ADRs), plans, reviews
drizzle/       generated SQL migrations
src/app/       routes, layouts, route handlers (api/)
src/components/    app components · ui/ = shadcn-generated primitives
src/lib/       db/ (Neon client + schema) · auth · onboarding · measurements
public/silhouettes/  homme.svg, femme.svg
tests/e2e/     Playwright specs
```

## Coding conventions

- **Next.js 16, not the one you remember.** `middleware.ts` is `proxy.ts`; the
  request APIs (`cookies()`, `headers()`, `params`) are async; Turbopack is the
  default bundler; `next lint` is gone in favour of calling `eslint`. Read the
  relevant guide in `node_modules/next/dist/docs/` before assuming an API.
- **Server Components by default**; `"use client"` only where interactivity
  actually requires it.
- **`src/components/ui/` is generated** by the shadcn CLI. Compose above it in
  `src/components/`; never hand-edit it.
- **Types are derived** from the Drizzle schema, not redeclared.
- **Naming**: components `PascalCase`, `lib` modules `kebab-case`, tables and
  columns `snake_case`.
- **Language**: UI text in French; code, table names, comments, commit messages
  and issues in English.
- **Tests**: unit tests next to the code (`*.test.ts(x)`, Vitest + Testing
  Library), e2e in `tests/e2e/`. Never install `@vitejs/plugin-react` — it drags
  in `@babel/core@8.0.0-rc` and conflicts with `shadcn`.

## Non-negotiable rules

A PR that breaks one of these will be asked to change, however good the rest is:

1. **The browser never talks to Postgres.** Reads and writes go through a
   Server Component or a route handler. No database or auth secret may be
   prefixed `NEXT_PUBLIC_`. There is no RLS to catch a mistake.
2. **Identity comes from `auth.getSession()`**, never from a `user_id` sent by
   the client. A handler that accepts an identifier as a parameter is a
   security bug, not a shortcut.
3. **Validate every payload with Zod on the server**, even when the client
   already did. Physiological ranges live per measurement `kind`, in one place.
4. **Empty is not zero.** An unfilled field produces no `measurements` row.
   Read Drizzle `numeric` columns as numbers, not strings.
5. **No hard-coded colors.** Values come from the tokens in
   `src/app/globals.css`.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short summary>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`. Example: `feat(charts): add body-fat reference line`.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Keep commits focused; keep the PR focused.
3. Make sure `npm run check` passes.
4. Open a PR against `main` and fill in the template.
5. Link the related issue (`Closes #123`).

Small, focused PRs get merged fastest. Be responsive to review feedback and
we'll do the same.
