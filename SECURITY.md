# Security Policy

## Supported versions

morpho is self-hosted: you deploy it yourself from this repository. Only the
**current `main` branch** receives security fixes. Please update to the latest
`main` and confirm an issue still reproduces before reporting it.

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| older commits | :x:          |

## Security model

A few properties are load-bearing. Keep them in mind when auditing or
contributing — a regression on any of them is a security bug, not a style nit:

- **The browser never talks to Postgres.** Every read and write goes through a
  Server Component or a route handler. No database or auth credential may be
  exposed with a `NEXT_PUBLIC_` prefix. There is no RLS in the database: user
  isolation lives entirely in this application code.
- **Identity comes from the verified session.** Handlers read the user id from
  `auth.getSession()` — never from a request body, query string or header. Any
  path where a client-supplied identifier selects or writes rows is a
  vulnerability.
- **Every payload is validated server-side with Zod**, even when the client
  already validated it.
- **Session cookies** are `sameSite: 'lax'`, HTTP-only and server-set
  (ADR 008); the auth server is reached only through the app's own
  `/api/auth/**` proxy.
- **The service worker cache is purged on sign-out** (ADR 018), so measurements
  don't survive a sign-out on a shared device.
- **The `neon_auth` schema belongs to Neon Auth.** Migrations manage `public`
  only; a migration touching `neon_auth` is a defect.

Data lives in the operator's own Neon project. The app sends no analytics and
loads no third-party scripts.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately through one of:

1. **GitHub Security Advisories** — preferred. Use
   [*Report a vulnerability*](https://github.com/oliviermattei/morpho/security/advisories/new)
   on the repository's Security tab.
2. **Email** — `hello@feedvox.co`.

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (a proof of concept if possible).
- The commit or deployment you tested against.

### What to expect

- Acknowledgement within **72 hours**.
- An initial assessment and severity classification.
- Coordinated disclosure: we'll agree on a timeline and credit you in the
  release notes unless you prefer to stay anonymous.

Thank you for helping keep morpho and the people who run it safe.
