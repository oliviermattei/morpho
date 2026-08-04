# Research — Story s01-deploy-skeleton

> Phase Research du pipeline killer-saas. Contexte vérifié uniquement : aucun code écrit, aucun plan.
> Tout ce qui est affirmé ici a été ouvert, exécuté ou mesuré. Ce qui ne l'a pas été est en « Questions ouvertes ».

## Target story

**As a** propriétaire de morpho **I want** une app déployée dont l'API refuse les requêtes non authentifiées **so that** la base ne soit jamais joignable depuis le navigateur. — Complexity 3.

Critères d'acceptation, verbatim de `morpho/docs/stories.md` :

1. `morpho/` contient une app Vite + React qui démarre en local (`npm run dev`) et produit un build (`npm run build`).
2. L'app est déployée et accessible à une URL publique ; le déploiement se déclenche depuis le dépôt.
3. Une route API serverless existe et répond 401 à toute requête sans session valide, sans exécuter la moindre requête base.
4. Une route API de santé, non protégée, atteint la base Neon et retourne un succès — la connexion Postgres est prouvée côté serveur.
5. Une recherche de la connection string Neon (`postgres://`, nom d'hôte Neon) dans les fichiers produits par `npm run build` ne retourne aucun résultat.
6. Une recherche d'analytics ou de traceurs tiers (Google Analytics, Segment, Plausible, Sentry, Hotjar…) dans le build ne retourne aucun résultat, et l'app ne contient aucun écran premium ni emplacement publicitaire.
7. Les secrets (connection string, clés) sont fournis par variables d'environnement, jamais commités ; `.env` est ignoré par git.
8. `compoundSimulator/` continue de builder à l'identique — l'ajout de `morpho/` ne casse rien dans le monorepo.

### Conflit de cadrage à trancher au Plan (critère 1)

Le critère 1 dit « app **Vite + React** ». **[ADR 001](../decisions/001-nextjs-app-router-base.md) l'a explicitement remplacé par Next.js 16 App Router**, et le scaffolding déjà commité (`6ee6ba7 adding morpho`) est du Next.js. `stories.md` a été rédigé avant la phase Architecture et n'a pas été réécrit sur ce point. Les ADR priment (règle du dépôt : l'architecture est validée avant les stories d'exécution).

Conséquence concrète, vérifiée dans `morpho/package.json` : les noms de scripts `dev` et `build` existent bien (`next dev`, `next build`), donc le critère reste littéralement satisfaisable. En revanche `npm run preview` (habitude Vite) **n'existe pas** — l'équivalent est `npm run start`.

## Current state of the code

### Ce qui existe réellement dans `morpho/`

Arborescence complète des sources (relevée, pas supposée) :

```
morpho/
  src/app/favicon.ico      (create-next-app)
  src/app/globals.css      Tailwind v4 + tokens morpho — déjà à jour
  src/app/layout.tsx       boilerplate create-next-app
  src/app/page.tsx         boilerplate create-next-app
  src/lib/utils.ts         cn() shadcn, 6 lignes
  src/lib/db/              DOSSIER VIDE
  tests/e2e/               DOSSIER VIDE
  public/                  file.svg globe.svg next.svg vercel.svg window.svg (create-next-app)
```

Ce que l'architecture décrit et qui **n'existe pas encore** :

- `src/components/` — le dossier **n'existe pas du tout** (pas seulement `ui/` vide : le parent est absent).
- `src/lib/db/schema.ts`, `src/lib/db/index.ts` — absents (`src/lib/db/` est vide).
- `src/lib/auth.ts` — absent.
- `src/proxy.ts` — absent.
- `src/app/api/` — absent, aucun route handler.
- `drizzle/` — absent, aucune migration.
- Aucun fichier de test (`src/**/*.test.ts(x)` : zéro), aucune spec Playwright.

### Fichiers de configuration (tous vérifiés, présents et commités)

| Fichier | Contenu utile pour s01 |
|---|---|
| `package.json` | Next `16.2.12`, React `19.2.4`. Scripts : `dev`, `build`, `start`, `lint` (`eslint`), `typecheck`, `test`, `test:e2e`, `db:generate`, `db:migrate`, `db:studio`, `check` = `typecheck && lint && test` |
| `next.config.ts` | **vide** (`const nextConfig: NextConfig = {}`) — pas de clé `env`, pas de `cacheComponents` |
| `drizzle.config.ts` | `dialect: postgresql`, `schema: ./src/lib/db/schema.ts`, `out: ./drizzle`, `url: process.env.DATABASE_URL!`, `schemaFilter: ["public"]` |
| `components.json` | style `radix-nova`, `rsc: true`, alias `ui: @/components/ui` |
| `vitest.config.ts` | `environment: jsdom`, `setupFiles: ./vitest.setup.ts`, `include: ["src/**/*.test.{ts,tsx}"]`, alias `@` → `./src` |
| `playwright.config.ts` | `testDir: ./tests/e2e`, `baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000"`, projets `mobile` (`devices["iPhone 13"]`) et `desktop`, `webServer: npm run dev` si pas de `E2E_BASE_URL` |
| `eslint.config.mjs` | `eslint-config-next/core-web-vitals` + `/typescript` (plus de `next lint`) |
| `tsconfig.json` | `strict: true`, `jsx: "react-jsx"`, `paths: { "@/*": ["./src/*"] }` |
| `.env.example` | `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `E2E_BASE_URL` — clés seules, aucune valeur |

### `src/app/globals.css` — déjà conforme au design system

Vérifié ligne à ligne : les trois ajouts morpho au preset **sont déjà en place**, s01 n'a rien à y ajouter :

- `--progress-favorable` : `oklch(0.55 0.12 152)` (`:root`) / `oklch(0.7 0.14 152)` (`.dark`)
- `--progress-adverse: var(--destructive)` dans les deux jeux
- `--label-min-size: 0.75rem`, exposé en `--text-label-min` dans `@theme inline`
- mapping `--color-progress-favorable` / `--color-progress-adverse` dans `@theme inline`
- `@custom-variant dark (&:is(.dark *))` — le mode sombre est piloté **par classe**, pas par media query

### `src/app/layout.tsx` et `src/app/page.tsx` — boilerplate non nettoyé

- `layout.tsx` : `metadata = { title: "Create Next App", description: "Generated by create next app" }`, `<html lang="en">`, polices `Geist`/`Geist_Mono` via `next/font/google`. **Aucun script de pose de la classe `dark`** — or `docs/design-system.md` §Thème l'attribue explicitement au shell : « C'est une tâche du shell (s01), pas un choix à refaire par story. » Cette tâche n'apparaît dans aucun critère d'acceptation.
- `page.tsx` : page d'accueil create-next-app, logos Next/Vercel, liens `utm_source=create-next-app`, et **couleurs en dur interdites par le design system** (`bg-zinc-50`, `dark:bg-black`, `text-black`, `text-zinc-600`, `hover:bg-[#383838]`, `dark:hover:bg-[#ccc]`) plus des valeurs arbitraires (`md:w-[158px]`, `max-w-xs`).

### État mesuré des commandes (exécutées, pas déduites)

| Commande | Résultat constaté |
|---|---|
| `npm run typecheck` | ✅ exit 0, aucune sortie |
| `npm run lint` | ✅ `ESLint: No issues found` |
| `npm run test` | ❌ **`No test files found, exiting with code 1`** |
| `npm run check` | ❌ **rouge aujourd'hui**, à cause de l'étape `test` ci-dessus |
| `npm run build` | ✅ `Next.js 16.2.12 (Turbopack)`, compilé en ~1,6 s. Routes : `○ /` et `○ /_not-found`, toutes deux statiques |
| `compoundSimulator/ → npm run build` | ✅ `vite v5.4.21`, 828 modules, `dist/assets/index-_RLzQ0Ae.js` **545,02 kB** (gzip 157,32 kB) — **baseline à conserver pour le critère 8** |

### État du dépôt et de l'environnement

- Branche `main`, arbre propre. Derniers commits : `8a3f73b docs: design system`, `d4628fb docs: architecture`, `6ee6ba7 adding morpho`.
- `git check-ignore` confirme : `morpho/.env` et `morpho/.env.local` ignorés par `morpho/.gitignore:34 (.env*)`, `morpho/.next/` ignoré par `morpho/.gitignore:17`. `!.env.example` réintroduit le fichier d'exemple, qui **est** suivi. **Le critère 7 est déjà techniquement satisfait par le scaffolding** — reste à le démontrer.
- `.gitignore` racine = `.DS_Store`, `*/node_modules`, `*/dist` (couvre `compoundSimulator/dist`).
- **Aucun `.github/`**, aucun workflow CI. Aucun `vercel.json`, aucun `.vercel/` nulle part dans le dépôt.
- `vercel`, `neon`, `neonctl` : **aucune CLI installée** (`command not found`).
- `DATABASE_URL` et `NEON_AUTH_BASE_URL` : **absents de l'environnement** (vérifié via `process.env`).
- Node `v22.17.0`, npm `11.12.0`.
- Le dépôt contient aussi `leasing_km_tracker/`, non mentionné dans `docs/architecture.md` (§Repo structure ne liste que `compoundSimulator/` et `morpho/`). Sans impact sur s01, mais la carte du dépôt est incomplète.

## Anchor points

Où chaque critère vient se brancher, avec les chemins réels (tous sous `morpho/`) :

| Critère | Point d'ancrage |
|---|---|
| 1 — dev + build | `package.json` scripts `dev`/`build` : **existent déjà et fonctionnent**. Rien à créer ; à démontrer. |
| 2 — déploiement | Hors dépôt : réglages du projet Vercel (Root Directory `morpho/`, cf. [ADR 006](../decisions/006-vercel-project-per-app.md)). Aucun artefact versionné n'existe aujourd'hui pour le matérialiser. |
| 3 — route 401 | Nouveau `src/app/api/<nom>/route.ts` (convention `route.ts` sous `src/app/`, cf. doc locale `01-app/01-getting-started/15-route-handlers.md`). S'appuie sur `src/lib/auth.ts` (à créer) → `createNeonAuth` depuis `@neondatabase/auth/next/server`. Éventuellement `src/proxy.ts` (voir Questions ouvertes n°5). |
| 4 — route de santé | Nouveau `src/app/api/<nom>/route.ts`, non protégé. `neon()` de `@neondatabase/serverless` + `process.env.DATABASE_URL`. Le client vit en `src/lib/db/` (dossier créé et vide, prêt). |
| 5 — grep du build | Sortie de `next build` : `.next/`. **Périmètre de recherche à élargir — voir Trap n°3, c'est le point le plus important de cette recherche.** |
| 6 — anti-analytics | `package.json` (aucune dépendance analytics aujourd'hui) + `.next/` + `src/app/page.tsx` (boilerplate Vercel à retirer). |
| 7 — secrets | `morpho/.gitignore` + `morpho/.env.example`, déjà en place. |
| 8 — non-régression | `compoundSimulator/` : ne rien y toucher ([ADR 006](../decisions/006-vercel-project-per-app.md)). Baseline de build ci-dessus. |
| Tests | `src/**/*.test.ts(x)` (Vitest, co-localisés) et `tests/e2e/*.spec.ts` (Playwright). Les deux dossiers cibles sont prêts. |

## Verified APIs / functions

### Next.js 16.2.12 — lu dans `morpho/node_modules/next/dist/docs/`

Version confirmée : `node -p "require('next/package.json').version"` → `16.2.12`.

**Route handlers** (`01-app/01-getting-started/15-route-handlers.md`)
- Convention : fichier `route.js|ts` sous `app/`. Un `route.ts` et un `page.ts` ne peuvent pas coexister sur le même segment.
- Méthodes supportées : `GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS`. Une méthode non exportée → **405** automatique.
- « Route Handlers are not cached by default. » Le `GET` peut opter pour le cache via `export const dynamic = 'force-static'`.
- Le modèle « Cache Components » décrit dans cette page ne s'applique **que si** `cacheComponents` est activé dans `next.config.ts` — ce n'est pas le cas ici (`next.config.ts` est vide). On est donc dans le modèle classique.
- Helper de typage : `RouteContext<'/users/[id]'>`, avec `const { id } = await ctx.params` (**params asynchrones**).

**Proxy** (`01-app/01-getting-started/16-proxy.md` et `01-app/03-api-reference/03-file-conventions/proxy.md`)
- « Starting with Next.js 16, Middleware is now called Proxy. » Fichier `proxy.ts` **à la racine du projet ou dans `src/` si applicable, au même niveau que `app`** → ici : `src/proxy.ts`.
- Export unique, en `export default` ou en export nommé `proxy`. Un seul fichier proxy par projet.
- Objet `config` optionnel avec `matcher`. **Sans `matcher`, le proxy s'exécute sur *chaque* requête**, y compris `_next/static`, `_next/image` et les assets de `public/` — la doc avertit explicitement que la logique d'auth peut alors bloquer CSS/JS/images.
- Les valeurs de `matcher` doivent être des constantes analysables au build.
- `export const runtime` **n'est pas utilisable dans le proxy**.

**Route segment config** (`.../02-route-segment-config/index.md`)
- Options encore disponibles en 16 : `dynamicParams` (défaut `true`), `runtime` (`'nodejs' | 'edge'`, défaut **`'nodejs'`**), `preferredRegion`, `maxDuration`.
- `dynamic`, `revalidate`, `fetchCache` ne sont supprimés **que si Cache Components est activé**. Ici il ne l'est pas : `export const dynamic = 'force-dynamic'` reste valide (valeurs documentées dans `02-guides/caching-without-cache-components.md` : `'auto' | 'force-dynamic' | 'error' | 'force-static'`).

**Variables d'environnement** (`02-guides/environment-variables.md`)
- Seules les variables préfixées `NEXT_PUBLIC_` sont destinées au navigateur ; les autres restent côté Node.
- ⚠️ « If you are using a `/src` folder, Next.js will load the `.env` files **only** from the parent folder and **not** from `/src`. » → les `.env` vont à la racine de `morpho/`, pas dans `morpho/src/`.
- `next.config.ts` accepte une clé `env` qui, elle, **inline** les valeurs au build — à ne surtout pas utiliser pour un secret. Vérifié : `.next/required-server-files.json` → `config.env` vaut `{}` aujourd'hui.
- `@next/env` (`loadEnvConfig`) est le mécanisme documenté pour charger les `.env` hors runtime Next (config d'ORM, runner de tests). Non installé ici ; `drizzle.config.ts` utilise `dotenv/config` à la place (`dotenv ^17.4.2` est bien en devDependencies).

### `@neondatabase/auth@0.4.2-beta` — lu dans `node_modules/@neondatabase/auth/dist/`

Version confirmée dans `package.json`. Sous-chemins exportés : `.`, `./types`, `./react`, `./react/ui`, `./react/ui/server`, `./react/adapters`, `./vanilla`, `./vanilla/adapters`, `./next`, `./next/server`, `./ui/css`, `./ui/tailwind`. `peerDependencies.next: ">=16.0.0"`, devDependency `next 16.2.6` → **le paquet est bien conçu pour Next 16**.

**`createNeonAuth(config)`** — `@neondatabase/auth/next/server` (`dist/next/server/index.d.mts`)

```
config: {
  baseUrl: string
  cookies: { secret: string; sessionDataTtl?: number /* défaut 300 s */;
             domain?: string; sameSite?: 'strict'|'lax'|'none' /* défaut 'strict' */ }
  logger?: NeonAuthLogger; logLevel?: 'error'|'warn'|'info'|'debug'|'silent' /* défaut 'warn' */
}
→ NeonAuth = NeonAuthServer & {
    handler: () => { GET, POST, PUT, DELETE, PATCH }
    middleware: (cfg?: { loginUrl?: string }) => (req: NextRequest) => Promise<NextResponse>
  }
```

- **Validation synchrone à l'appel** (`dist/next/server/index.mjs`, `createNeonAuth` → `validateCookieConfig`) :
  `if (!cookies.secret) throw new Error(...MISSING_COOKIE_SECRET)` puis `if (cookies.secret.length < 32) throw new Error(...COOKIE_SECRET_TOO_SHORT)`.
  **`baseUrl` n'est PAS validé** — un `baseUrl` `undefined` ne lève rien et échouera plus tard, au `fetch`.
- Le handler d'API se monte sur `app/api/auth/[...path]/route.ts` : `export const { GET, POST } = auth.handler()`. Signature vérifiée : `(request: Request, { params }: { params: Promise<{ path: string[] }> })` — **`params` est bien une Promise**, cohérent avec Next 16.
- Le module importe `{ cookies, headers } from "next/headers"` (ligne 4 de `dist/next/server/index.mjs`).

**`auth.getSession()` — forme de retour, ADR 003 point 2 RÉSOLU**

Relevée dans `dist/next/index.d.mts` (déclaration de `getSession`), et cohérente avec le runtime :

```ts
{ data: {
    user: { id: string; email: string; emailVerified: boolean; name: string;
            createdAt: Date; updatedAt: Date; image?: string|null;
            banned?: boolean|null; role?: string|null; banReason?: string|null;
            banExpires?: Date|null; phoneNumber?: string|null; phoneNumberVerified?: boolean|null },
    session: { id: string; userId: string; token: string; expiresAt: Date;
               createdAt: Date; updatedAt: Date; ipAddress?: string|null;
               userAgent?: string|null; impersonatedBy?: string|null;
               activeOrganizationId?: string|null }
  } | null,
  error: { message; status; statusText; code } | null }
```

→ **L'identifiant utilisateur est `session.user.id`, de type `string`.** C'est cette valeur que s03 utilisera en clé étrangère. `getSession()` **ne lève pas** : elle renvoie `{ data: null, error: {...} }` en cas d'échec (vérifié dans le corps de `fetchWithAuth`).

**Comportement runtime de `getSession()` côté serveur** (`dist/next/server/index.mjs`, wrapper autour de `originalGetSession`)
1. Lit les cookies via le contexte Next.
2. Si le cookie `session_token` **et** le cookie signé `session_data` sont présents et valides → retourne le payload **sans appel réseau**.
3. Sinon → **appel HTTP sortant** vers `baseUrl` (`GET /get-session`).

**Noms de cookies** (`dist/next/server/index.mjs`, `src/server/constants.ts`)
- préfixe : `__Secure-neon-auth`
- `__Secure-neon-auth.session_token` (cookie d'auth principal)
- `__Secure-neon-auth.local.session_data` (cache de session signé, JWT)
- `__Secure-neon-auth.session_challange` (*sic* — faute de frappe dans la librairie, à ne pas « corriger »)
- Tous posés avec `httpOnly: true, secure: true, sameSite: 'strict'` par défaut.

**Endpoints exposés** (constante `API_ENDPOINTS`, utile pour s02) : `getSession`, `getAccessToken`, `signIn.{email,social,emailOtp,magicLink}`, `signUp.email`, `signOut`, `magicLink.verify` (GET), `refreshToken`, `revokeSession(s)`, `updateUser`, `deleteUser`, `verifyEmail`, `token`, `jwks`, plus les familles `admin.*`, `organization.*`, `emailOtp.*`.

### `@neondatabase/serverless@1.1.0`

```ts
neon(connectionString: string, options?: HTTPTransactionOptions): NeonQueryFunction
```
Options relevées dans `index.d.mts` : `arrayMode` (défaut `false`), `fullResults` (défaut `false`), `fetchOptions` (« merged in to the options passed to `fetch` », **priorité sur le reste**), `authToken`, `types`, `disableWarningInBrowsers`, `isolationLevel`, `readOnly`, `deferrable`.
**Il n'existe aucune option `timeout` dédiée.** Le seul levier pour borner le cold start Neon est `fetchOptions` (donc un `AbortSignal`).
La présence même de `disableWarningInBrowsers` confirme que le driver *peut* tourner dans un navigateur : la règle « le navigateur ne parle jamais à Postgres » est une discipline de code, pas une garantie de la librairie.

### `drizzle-orm@0.45.2`

- `drizzle` de `drizzle-orm/neon-http` accepte `(client | connectionString)`, `(client | connectionString, config)` ou `({ ...config, connection })` / `({ ...config, client })`. Retourne `NeonHttpDatabase<TSchema> & { $client }`.
- `numeric(name, { mode })` avec `mode: 'string' | 'number' | 'bigint'`. Vérifié dans `pg-core/columns/numeric.d.ts` :
  - défaut / `'string'` → `PgNumeric`, `mapFromDriverValue(value): string`
  - **`'number'` → `PgNumericNumber`, `mapFromDriverValue(value): number`** ← c'est la forme exigée par [ADR 004](../decisions/004-measurements-as-rows.md)
  - `decimal` est un alias de `numeric`.

## Traps & constraints

**1. `npm run check` est ROUGE aujourd'hui.** `npm run test` → `No test files found, exiting with code 1`. Or `npm run check` est la commande que la review invoque ([ADR 005](../decisions/005-testing-stack.md)). Tant qu'aucun test Vitest n'existe sous `src/`, la gate de s01 est mécaniquement impossible à passer. Le TDD imposé par le pipeline le résout de fait, mais c'est à vérifier explicitement en fin de story.

**2. Le critère 1 dit « Vite », l'ADR 001 dit Next.js.** Voir §Target story. À expliciter dans le plan pour qu'un reviewer en contexte frais ne le lise pas comme une dérive d'implémentation.

**3. ⚠️ Le critère 5 (grep du build) est piégé : le vecteur de fuite n'est PAS là où on regarde.**

Expérience conduite puis annulée (deux routes sonde temporaires, `rm -rf .next` avant build, build lancé avec `DATABASE_URL='postgres://SENTINELUSER:SENTINELPASS@ep-sentinel-123.us-east-2.aws.neon.tech/neondb'` et `NEXT_PUBLIC_PROBE='SENTINELPUBLIC'`, un composant `"use client"` lisant les deux). Résultat scanné sur **tout** `.next/` :

| Sentinelle | Où elle apparaît |
|---|---|
| `SENTINELPUBLIC` (`NEXT_PUBLIC_`) | `.next/static/chunks/1-loicsybhc1k.js`, `.next/server/chunks/…`, **et** `.next/server/app/zprobeclient.html` |
| `SENTINELPASS` (`DATABASE_URL`, non public) | **uniquement `.next/server/app/zprobeclient.html`** |

Extrait littéral du HTML prérendu :

```html
<div>SENTINELPUBLIC<!-- -->postgres://SENTINELUSER:SENTINELPASS@ep-sentinel-123.us-east-2.aws.neon.tech/neondb</div>
```

Trois enseignements :

- **Un secret non-`NEXT_PUBLIC_` ne fuit pas dans `.next/static/*.js`, mais fuit intégralement dans le HTML prérendu servi au navigateur.** Un composant `"use client"` est aussi rendu côté serveur au build ; à ce moment-là `process.env.DATABASE_URL` a une vraie valeur, et le résultat est figé dans le HTML. **Chercher seulement dans `.next/static/` donne un faux « pass ».** Le périmètre de recherche doit couvrir `.next/static/**` *et* `.next/server/app/**/*.html` *et* les payloads RSC (`*.rsc`, `*.segments/*.rsc`), qui partent aussi vers le navigateur.
- Turbopack (Next 16.2.12) **n'inline pas** `process.env.X` au point d'usage dans le bundle client : le chunk contient `t.default.env.NEXT_PUBLIC_PROBE` — un accès runtime sur un shim `process`. Un `grep "postgres://"` sur les chunks client ne prouve donc rien sur la mécanique, seulement sur le résultat.
- **Le critère n'est falsifiable que si le build tourne avec l'environnement réellement peuplé.** Un `npm run build` local sans `DATABASE_URL` ne peut rien trouver : il n'y a rien à trouver. Le protocole de vérification doit préciser sur quel build il porte.

**4. `.next/` périmé = résultat faux.** Les noms de chunks changent d'un build à l'autre ; un scan sur un `.next/` sale m'a donné deux fois des résultats contradictoires. Toute vérification du critère 5 doit commencer par `rm -rf .next`.

**5. `createNeonAuth()` lève à l'import si le secret manque.** `validateCookieConfig` jette `MISSING_COOKIE_SECRET` (secret absent) ou `COOKIE_SECRET_TOO_SHORT` (< 32 caractères). Si `src/lib/auth.ts` appelle `createNeonAuth` au niveau module et que ce module est évalué pendant `next build` (collecte des routes, prérendu), **c'est le build qui casse**, pas seulement la requête. `NEON_AUTH_COOKIE_SECRET` est absent de cet environnement : sans précaution, ajouter `src/lib/auth.ts` rend `npm run build` impossible en local.

**6. La route 401 fait quand même un appel réseau.** Sans cookie `session_data` valide, `getSession()` retombe sur un `fetch` vers `NEON_AUTH_BASE_URL`. Le critère 3 (« sans exécuter la moindre requête base ») est respecté — Postgres n'est pas touché — mais : (a) la route dépend de la joignabilité du serveur Neon Auth ; (b) une panne réseau produit `{ data: null, error }`, indistinguable d'une absence de session pour un handler naïf, qui renverra donc 401 pour « serveur d'auth injoignable ».

**7. Les cookies Neon Auth sont `__Secure-` et `secure: true`.** `playwright.config.ts` pointe par défaut sur `http://localhost:3000`. Sans conséquence pour s01 (le chemin 401 ne nécessite aucun cookie), mais c'est le piège qui attend s02 en e2e local.

**8. Un `src/proxy.ts` sans `matcher` s'exécute sur TOUTES les requêtes**, y compris `_next/static`, `_next/image` et `public/`. Si s01 introduit le proxy, la route de santé (non protégée, critère 4) et les assets statiques doivent être exclus explicitement. La doc Next avertit que l'omission bloque CSS/JS/images.

**9. Playwright : le navigateur `webkit` n'est PAS installé.** `~/Library/Caches/ms-playwright/` contient `chromium-1228/`, `chromium_headless_shell-1228/`, `ffmpeg-1011/` — **pas de `webkit-*`**. Or `devices["iPhone 13"].defaultBrowserType === "webkit"` (vérifié). Le projet `mobile`, qui est la cible principale du produit, **ne peut pas s'exécuter** en l'état. `npx playwright install` est une tâche de s01 ([ADR 005](../decisions/005-testing-stack.md) le dit).

**10. `devices["iPhone 13"]` fait 390 × 664, pas 375.** Relevé exact : `viewport: { width: 390, height: 664 }`, `deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`. Les critères de s06 et s07 sont écrits « sur une fenêtre de **375 px** de large ». Le projet `mobile` tel que configuré ne les teste donc pas à la largeur annoncée. s01 est la story qui pose le harnais : c'est ici que l'écart se corrige ou se documente.

**11. Avertissement Vitest à chaque run.** `morpho/package.json` n'a pas `"type": "module"`, donc Vite charge `vitest.config.ts` en CommonJS et émet : *« Your Vite config uses features that are unsupported by `configLoader: 'native'` … ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1) »*. Sans effet fonctionnel aujourd'hui, mais bruit dans toutes les sorties de test.

**12. Le boilerplate create-next-app viole le design system.** `page.tsx` contient des couleurs en dur (`bg-zinc-50`, `text-black`, `hover:bg-[#383838]`) et des valeurs arbitraires (`md:w-[158px]`), explicitement interdites par `docs/design-system.md` §Do/Don't. `layout.tsx` porte `title: "Create Next App"` et `lang="en"` (l'UI doit être en français). Et le script inline de pose de la classe `dark` — attribué au shell de s01 par le design system — est absent. **Aucun de ces trois points n'est couvert par un critère d'acceptation de s01.**

**13. Critère 6 (anti-analytics) : rien à retirer côté dépendances, mais un risque à l'ajout.** `package.json` ne contient aujourd'hui aucun traceur. Les deux surfaces de risque sont (a) le boilerplate `page.tsx` qui embarque logos Vercel/Next et liens `utm_source=create-next-app`, (b) l'onboarding Vercel, qui propose d'ajouter `@vercel/analytics` et `@vercel/speed-insights` — à refuser.

**14. Ne pas toucher `compoundSimulator/`** ([ADR 006](../decisions/006-vercel-project-per-app.md)). Baseline capturée pour le critère 8 : `vite v5.4.21`, 828 modules, `dist/assets/index-_RLzQ0Ae.js` 545,02 kB / gzip 157,32 kB. Le nom de fichier étant un hash de contenu, il constitue une preuve de non-régression exploitable.

**15. Aucune dépendance entre modules à craindre** : s01 est la première story, il n'existe aucun code métier antérieur, aucun test existant à ne pas casser. Le seul « code touché par une story précédente » est le scaffolding lui-même.

**16. `npm audit` remonte 3 vulnérabilités « high » transitives à Next.js** (constat déjà enregistré dans `docs/architecture.md` §Points ouverts, point 5). Pas d'action : le correctif proposé rétrograde Next en v9. À ne pas « corriger » par réflexe pendant s01.

## Open questions

À trancher au Plan (ou à remonter), faute d'avoir pu être établi depuis le code :

1. **Aucun projet Neon ni Neon Auth n'est joignable depuis cet environnement.** `DATABASE_URL`, `NEON_AUTH_BASE_URL` et `NEON_AUTH_COOKIE_SECRET` sont absents ; aucune CLI Neon n'est installée. Existent-ils déjà côté Neon, ou faut-il les créer ? Rien dans le dépôt ne permet de le dire.

2. **Le nom de la table de synchronisation du schéma `neon_auth` reste inconnu — et ne peut pas être trouvé dans `node_modules`.** J'ai scanné l'intégralité de `@neondatabase/auth` : les seules occurrences de « neon_auth » sont des faux positifs insensibles à la casse sur des constantes `NEON_AUTH_*` (noms de cookies, paramètres d'URL de popup OAuth). **Le SDK est un pur client HTTP ; il ne décrit aucun schéma Postgres.** Le point 1 des conséquences de [ADR 003](../decisions/003-neon-auth.md) reste donc entier et ne se résoudra qu'avec une base réelle (ou la console Neon), en `/ks-research s02`. Ce que j'ai pu établir en revanche : la forme de `session.user` (point 2 de l'ADR), résolue ci-dessus — `user.id: string`.

3. **Comment le déploiement Vercel se matérialise-t-il ?** Aucun `vercel.json`, aucun `.vercel/`, aucune CLI, aucun workflow `.github/`. Le critère 2 (« le déploiement se déclenche depuis le dépôt ») est-il satisfait par l'intégration Git native de Vercel configurée au tableau de bord — auquel cas rien n'est vérifiable dans le diff — ou attend-on un artefact versionné ? [ADR 006](../decisions/006-vercel-project-per-app.md) et `docs/architecture.md` §Points ouverts (point 4) renvoient tous deux la Root Directory à « la review de s01 », sans dire comment la prouver.

4. **Quelle requête et quel timeout pour la route de santé ?** `neon()` n'a pas d'option `timeout` ; seul `fetchOptions` (donc un `AbortSignal`) permet de borner le cold start ~500 ms mentionné par la story. Valeur du timeout, requête exécutée (`select 1` ?) et forme de la réponse : décisions de plan, non tranchées par les docs.

5. **`src/proxy.ts` naît-il en s01 ou en s02 ?** Le critère 3 n'exige qu'un 401 sur une route API — faisable entièrement dans le handler. `docs/architecture.md` §Integration points place la protection des routes dans `src/proxy.ts`, mais `auth.middleware()` **redirige** vers `loginUrl` au lieu de renvoyer 401, ce qui ne satisfait pas littéralement le critère pour une route d'API. Le partage des rôles handler / proxy n'est arbitré nulle part.

6. **La route protégée doit-elle distinguer « pas de session » de « serveur d'auth injoignable » ?** Voir Trap n°6. 401 dans les deux cas, ou 401 / 503 ? Le critère ne le dit pas.

7. **Projet Playwright `mobile` : 390 px (iPhone 13 tel quel) ou viewport forcé à 375 px ?** Voir Trap n°10. Le choix conditionne la vérifiabilité de critères de s06 et s07.

8. **Le nettoyage du boilerplate et le script de thème sombre entrent-ils dans s01 ?** Le design system attribue le script `dark` au « shell (s01) », mais aucun critère d'acceptation ne le mentionne, et s01 est déclarée « sans écran ». Ajouter = dépasser le périmètre ; ne pas ajouter = laisser une dette que le design system considère comme déjà payée.

9. **Sur quel build le critère 5 sera-t-il vérifié, et avec quel environnement ?** Voir Trap n°3 : un build local sans secret ne prouve rien. Build Vercel ? Build local avec un `.env` temporaire ? Le protocole doit être écrit avant la review, sinon le critère sera coché sans preuve.

10. **Base de test pour les futurs tests d'isolation** — non bloquant pour s01, mais le choix (branche Neon éphémère / base dédiée / Postgres local) reste ouvert et [ADR 005](../decisions/005-testing-stack.md) le renvoie à `/ks-research s03`. À ne pas préempter ici.
