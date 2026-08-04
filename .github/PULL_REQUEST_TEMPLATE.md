<!--
Thanks for contributing! Please fill out this template.
Keep PRs focused — smaller PRs get reviewed and merged faster.
-->

## Description

<!-- What does this PR do and why? -->

## Related issue / plan

<!-- e.g. Closes #123. If the change follows a plan in docs/plans/, name it. -->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Documentation
- [ ] Build / CI / chore

## Checklist

- [ ] `npm run check` passes (typecheck + eslint + vitest).
- [ ] E2E specs run locally if I touched a user-facing flow (`npm run test:e2e`).
- [ ] I followed the [Conventional Commits](https://www.conventionalcommits.org/) format.
- [ ] No database or auth secret is exposed to the client (`NEXT_PUBLIC_`).
- [ ] Identity is read from the session, never from a client-supplied `user_id`.
- [ ] New payloads are validated with Zod on the server.
- [ ] Empty fields stay empty — never stored or displayed as `0`.
- [ ] No hard-coded colors; tokens from `src/app/globals.css` only.
- [ ] Migrations are generated (`npm run db:generate`), not hand-edited, and
      don't touch the `neon_auth` schema.
- [ ] Docs / ADRs updated where relevant.
