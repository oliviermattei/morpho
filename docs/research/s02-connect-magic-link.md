# Research — Story s02-connect-magic-link

> Phase Research du pipeline killer-saas. Ce document ne contient **aucun code** et **aucun plan** : uniquement du contexte vérifié, fichier ouvert à l'appui. Tous les chemins sont relatifs à `multitool/morpho/` sauf mention contraire.
>
> Méthode : lecture directe de `node_modules/@neondatabase/auth/dist/**` (les `.d.mts` **et** les `.mjs`, parce que la doc du paquet est incomplète), de `node_modules/next/dist/docs/**` pour Next 16, et de l'état réel de `src/`. Ce qui n'a pas pu être vérifié est listé tel quel en fin de document.

---

## Story cible

**Story s02-connect-magic-link — Connexion sans mot de passe**
**As a** propriétaire de morpho **I want** me connecter par un lien reçu par email **so that** mes données soient rattachées à moi plutôt qu'à mon téléphone.

Complexity : 3.

### Acceptance criteria (verbatim, `docs/stories.md` l. 49-56)

- [ ] Un visiteur non authentifié qui ouvre l'app arrive sur un écran de connexion demandant uniquement une adresse email.
- [ ] Soumettre une adresse email valide déclenche l'envoi d'un magic link et affiche un état « lien envoyé » ; aucun mot de passe n'est demandé à aucun moment.
- [ ] Ouvrir le magic link ouvre une session authentifiée et affiche un écran authentifié provisoire — écran d'accueil de cette story, remplacé par la silhouette en s06 — portant au minimum l'email connecté et le bouton de déconnexion.
- [ ] Une session active survit à un rechargement complet de la page : recharger ne renvoie pas sur l'écran de connexion.
- [ ] Le bouton de déconnexion termine la session ; l'écran suivant est celui de connexion, et un rechargement ne restaure pas la session terminée.
- [ ] La route protégée de s01 répond en succès avec une session valide, et continue de répondre 401 sans session.
- [ ] L'utilisateur authentifié existe en base avec un identifiant stable, réutilisable comme clé étrangère par les stories suivantes.
- [ ] L'identité utilisée côté serveur provient du token vérifié, jamais d'un identifiant envoyé par le client : une requête forgeant un autre identifiant n'accède pas aux données d'autrui.

### Dépendances déclarées

s01-deploy-skeleton (app déployée, couche API en place, base joignable). **Voir « Traps & constraints » § 1 : s01 n'est pas livré.**

---

## État actuel du code

### Ce qui existe réellement dans `src/`

Inventaire exhaustif (`find src tests drizzle -type f`) :

```
src/app/favicon.ico
src/app/globals.css
src/app/layout.tsx
src/app/page.tsx
src/lib/utils.ts
```

Cinq fichiers. **C'est le scaffolding brut de `create-next-app`, rien de plus.** Concrètement :

- `src/components/` **n'existe pas** — donc `src/components/ui/` non plus. Aucun composant shadcn n'est installé.
- `src/lib/db/` n'existe pas. `src/lib/auth.ts` n'existe pas.
- `src/app/api/` n'existe pas. Aucune route handler.
- `src/proxy.ts` n'existe pas.
- `drizzle/` n'existe pas, `src/lib/db/schema.ts` (pointé par `drizzle.config.ts`) n'existe pas.
- `tests/` n'existe pas (ni `tests/e2e/`), aucun `*.test.ts(x)`.

`src/app/page.tsx` est la page d'accueil template Next (logo Vercel, liens vers les templates, couleurs `bg-zinc-50`, `bg-[#383838]` en dur). `src/app/layout.tsx` porte encore `lang="en"`, `title: "Create Next App"`, et charge `Geist` / `Geist_Mono` via `next/font/google` en exposant `--font-geist-sans` / `--font-geist-mono`.

### État git

Branche `main` uniquement (plus une branche distante sans rapport, `claude/deploy-leasing-km-tracker-coolify-fbsfpm`). Derniers commits : `8a3f73b docs: design system`, `d4628fb docs: architecture`, `ee4ef53 docs: stories review — pass 2`. **Aucune branche `feature/s01-deploy-skeleton`, aucun commit de code applicatif.**

### Configuration en place (vérifiée)

| Fichier | Contenu utile pour s02 |
|---|---|
| `package.json` | `@neondatabase/auth ^0.4.2-beta`, `@neondatabase/serverless ^1.1.0`, `next 16.2.12`, `react 19.2.4`, `drizzle-orm ^0.45.2`, `zod ^4.4.3`, `shadcn ^4.16.1`, `radix-ui ^1.6.7`, `lucide-react ^1.28.0`. Scripts : `check` = `typecheck && lint && test`. |
| `.env.example` | `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `E2E_BASE_URL`. Aucune valeur. Pas de `.env` local. |
| `components.json` | `style: "radix-nova"`, `baseColor: "neutral"`, `rsc: true`, `iconLibrary: "lucide"`, alias `@/components/ui`. |
| `vitest.config.ts` | `environment: "jsdom"`, `include: ["src/**/*.test.{ts,tsx}"]`, alias `@` → `./src`. |
| `playwright.config.ts` | `testDir: "./tests/e2e"`, projets `mobile` (iPhone 13) et `desktop`, `webServer: npm run dev` sur `http://localhost:3000` sauf si `E2E_BASE_URL`. |
| `drizzle.config.ts` | `schemaFilter: ["public"]`, `schema: "./src/lib/db/schema.ts"` (fichier absent). |
| `next.config.ts` | Vide. |
| `tsconfig.json` | `strict: true`, `jsx: "react-jsx"`, `paths: { "@/*": ["./src/*"] }`. |

### Design system : ce qui est déjà câblé

`src/app/globals.css` contient bien les tokens décrits dans `docs/design-system.md`, vérifiés ligne à ligne :

- l. 34-35 : `--color-progress-favorable` / `--color-progress-adverse` dans `@theme inline`.
- l. 37 : `--text-label-min: var(--label-min-size)`.
- l. 84-86 (`:root`) : `--progress-favorable: oklch(0.55 0.12 152)`, `--progress-adverse: var(--destructive)`, `--label-min-size: 0.75rem`.
- l. 97 : bloc `.dark` ; l. 113-114 : variantes sombres.
- `@custom-variant dark (&:is(.dark *))` en l. 5 → **le thème sombre est piloté par la classe `.dark` sur un ancêtre.**

**Aucun script ne pose la classe `.dark`** : `src/app/layout.tsx` ne fait rien de tel. Le thème sombre est donc, aujourd'hui, inatteignable. `docs/design-system.md` § Thème l. 51 attribue explicitement cette tâche au shell (s01), qui n'est pas livré.

Détail à signaler : `globals.css` l. 10 déclare `--font-sans: var(--font-sans)` (auto-référence) alors que `layout.tsx` expose `--font-geist-sans`. La famille typographique n'est donc probablement pas raccordée. C'est du ressort du shell, pas de s02, mais ça se verra sur le premier écran réel — qui est celui de cette story.

### Réseau et outillage disponibles

- Le registre shadcn répond : `https://ui.shadcn.com/r/styles/radix-nova/{button,input,label,field,form,spinner,sonner,empty,card,item,skeleton,alert}.json` → **200 pour les douze**. `npx shadcn@latest add …` est donc opérationnel.
- `registry.npmjs.org` répond 200.
- **Aucun `DATABASE_URL`, aucun `NEON_AUTH_BASE_URL`, aucun `NEON_AUTH_COOKIE_SECRET`. Aucune CLI Neon, aucune CLI Vercel.** Rien de ce qui touche à un serveur Neon Auth réel n'a pu être exécuté.

---

## Anchor points

Rien n'existe : s02 crée tout. Les emplacements ci-dessous sont **imposés** par le SDK ou par l'architecture, pas choisis librement.

| Point | Emplacement | Contrainte qui l'impose |
|---|---|---|
| Instance auth serveur | `src/lib/auth.ts` | `docs/architecture.md` § Integration points ; `createNeonAuth` doit être un singleton importé par le proxy, les route handlers et les Server Components. |
| Client auth navigateur | `src/lib/auth-client.ts` (`"use client"`) | `createAuthClient()` de `@neondatabase/auth/next` est un client React (hooks). Nommage kebab-case pour `lib/` (AGENTS.md). |
| Proxy d'auth HTTP | `src/app/api/auth/[...path]/route.ts` | Le client appelle `/api/auth/**` par défaut (voir § APIs vérifiées). Le segment est un catch-all ; le SDK type ses params en `Promise<{ path: string[] }>`. |
| Protection de routes + échange de session | `src/proxy.ts` | Next 16 : `middleware.ts` renommé `proxy.ts`, à la racine du projet **ou dans `src/`** (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` l. 35). L'architecture fixe `src/proxy.ts`. |
| Écran de connexion | `src/app/auth/sign-in/page.tsx` | **Contraint** : `SKIP_ROUTES` du middleware est en dur et contient `/auth/sign-in` (voir Traps § 3). |
| Écran authentifié provisoire | `src/app/page.tsx` (remplace le template) | AC 3 ; sera remplacé par la silhouette en s06. |
| Route API protégée + route de santé | `src/app/api/…` | Livrables **de s01**, absents. AC 6 de s02 les suppose existants. |
| Composants UI | `src/components/ui/` (généré CLI) + `src/components/` (composé) | AGENTS.md : `ui/` jamais édité à la main. |

---

## Verified APIs / functions

Toutes les références ci-dessous ont été ouvertes. Format : `chemin:ligne`.

### `createNeonAuth` — instance serveur

`node_modules/@neondatabase/auth/dist/next/server/index.d.mts:643`

```
declare function createNeonAuth(config: NeonAuthConfig): NeonAuth;
```

`NeonAuth` (`:648-651`) = `NeonAuthServer & { handler(): …; middleware(cfg?: Pick<NeonAuthMiddlewareConfig,'loginUrl'>): … }`, où `NeonAuthServer = Pick<VanillaBetterAuthClient, ServerAuthMethods>` (`:546`) — les clés de premier niveau de `API_ENDPOINTS`, donc `getSession`, `signIn`, `signUp`, `signOut`, `magicLink`, `updateUser`, etc.

`NeonAuthConfig` = `NeonAuthBase & NeonAuthLoggingInput` (`:111`) :
- `baseUrl: string` (`:100`) — exemple donné dans la doc du type : `'https://ep-xxxx.neonauth.us-east-1.aws.neon.tech'`.
- `cookies: SessionCookieConfig` (`:52-94`) : `secret` (**≥ 32 caractères, sinon throw**, `:64` + `dist/next/server/index.mjs:1037-1041`), `sessionDataTtl?` (défaut **300 s**, `:76`), `domain?`, `sameSite?` (**défaut `'strict'`**, `:93`).
- `logger?` / `logLevel?` (`:30-37`), `'silent'` disponible.

### Handler d'API

`dist/next/server/index.d.mts:158-184` — `authApiHandler(config)` retourne **`{ GET, POST, PUT, DELETE, PATCH }`**, chacun de signature `(request: Request, { params }: { params: Promise<{ path: string[] }> }) => Promise<Response>`. Le JSDoc du SDK montre `export const { GET, POST } = auth.handler()` : n'exporter que deux verbes suffit pour le flux magic link, mais les cinq existent.

### Middleware / proxy

`dist/next/server/index.d.mts:215` — `neonAuthMiddleware(config): (request: NextRequest) => Promise<NextResponse<unknown>>`. `auth.middleware({ loginUrl })` en est le wrapper (`dist/next/server/index.mjs:1780-1790`).

Comportement réel (`dist/next/server/index.mjs`) :

- `SKIP_ROUTES` (`:1572-1579`), **codé en dur, non configurable** :
  `["/api/auth", "/auth/callback", "/auth/sign-in", "/auth/sign-up", "/auth/magic-link", "/auth/email-otp", "/auth/forgot-password"]`.
- `checkSessionRequired` (`:1462-1481`) : autorise si le pathname commence par `loginUrl`, ou s'il matche un `SKIP_ROUTES`, ou si `session.session !== null`. Sinon → redirection.
- Sans session sur une route protégée : `action: "redirect_login"` → `NextResponse.redirect(new URL(loginUrl, request.url))` (`:1563-1566`, `:1641-1647`). **C'est une 307/302, jamais un 401.**
- Avec session : `NextResponse.next()` en ajoutant l'en-tête `x-neon-auth-middleware: "true"` (`:1055`, `:1547-1551`) et en réémettant les `Set-Cookie` rafraîchis.
- Le middleware ne parle à l'upstream que si le cookie de session est présent (`:1517-1544`) — un visiteur anonyme ne coûte pas d'aller-retour réseau.

### Échange de session au retour du lien (mécanisme clé)

`dist/next/server/index.mjs:1392-1398` — `needsSessionVerification(request)` : vrai si l'URL porte le paramètre `neon_auth_session_verifier` (nom défini dans `dist/better-auth-helpers-Bkezghej.mjs:19`) **et** que le cookie `__Secure-neon-auth.session_challange` est présent.

`:1412-1437` — `exchangeOAuthToken(...)` rejoue alors un `get-session` vers l'upstream, récupère les `Set-Cookie`, retire le paramètre de l'URL, et le middleware répond `redirect_oauth` vers l'URL nettoyée en posant les cookies (`:1636-1640`).

**Conséquence structurante : la matérialisation de la session sur le domaine de l'app passe par le proxy.** Une route de retour non couverte par le `matcher` de `src/proxy.ts` ne posera pas les cookies.

### Cookies

`dist/next/server/index.mjs:290-296` :

```
NEON_AUTH_COOKIE_PREFIX               = "__Secure-neon-auth"
…session_data  = "__Secure-neon-auth.local.session_data"   (JWT signé, cache de session)
…challenge     = "__Secure-neon-auth.session_challange"     (sic, faute de frappe dans le SDK)
…session_token = "__Secure-neon-auth.session_token"         (cookie d'authentification principal)
```

`secure: true` est forcé partout (`:568`, `:603`, `:1559`, `:333`).

### `auth.getSession()` — forme exacte du retour

`dist/next/index.d.mts:1892-1932`. Retour : `{ data: T | null, error: { code?, message? } | null }` avec

```
data.user    : { id: string; createdAt: Date; updatedAt: Date; email: string;
                 emailVerified: boolean; name: string; image?: string | null;
                 banned: boolean | null | undefined; role?: string | null;
                 banReason?: string | null; banExpires?: Date | null;
                 phoneNumber?: string | null; phoneNumberVerified?: boolean | null }
data.session : { id: string; createdAt: Date; updatedAt: Date; userId: string;
                 expiresAt: Date; token: string; ipAddress?: string | null;
                 userAgent?: string | null; impersonatedBy?: string | null;
                 activeOrganizationId?: string | null }
```

Le socle de ces types est `@better-auth/core/dist/db/schema/user.d.mts` (`userSchema` : `id` string, `email`, `emailVerified`, `name`, `image?`) et `…/schema/session.d.mts` (`sessionSchema` : `userId`).

**→ L'identifiant utilisateur stable exigé par l'AC 7 est `session.data.user.id`, de type `string`.** C'est lui qui sera la clé étrangère de `profiles.user_id` et `measurement_sessions.user_id` en s03/s04. Ce n'est **pas** un `uuid` typé côté SDK : c'est une chaîne.

Comportement caché de `getSession` côté serveur (`dist/next/server/index.mjs:891-912`) : avant tout appel réseau, la méthode lit le cookie `…local.session_data`, en vérifie la signature avec `cookies.secret`, et **retourne le payload du cookie sans contacter Neon** s'il est valide et que le cookie `session_token` est présent. On force l'appel upstream avec `getSession({ query: { disableCookieCache: "true" } })`.

### Client navigateur

`dist/next/index.mjs` :

```
function createAuthClient() {
  return createAuthClient$1(void 0, { adapter: BetterAuthReactAdapter() });
}
```

Aucun argument : `baseURL` vaut `undefined`, et `better-auth/dist/client/config.mjs:11` retombe alors sur **`"/api/auth"`**. Le client tape donc l'app elle-même, qui proxifie vers Neon. Pas d'URL Neon exposée au navigateur — cohérent avec la frontière serveur du projet.

Méthodes utiles (`dist/next/index.d.mts`) :

- `signIn.magicLink(data)` (`:1234-1254`) — `data: { email: string; name?: string; callbackURL?: string; newUserCallbackURL?: string; errorCallbackURL?: string; fetchOptions? }`. Retour : `{ data: { status: boolean } | null, error: { code?, message? } | null }`.
- `magicLink.verify(data)` (`:1257-1286`) — `data: { query: { token: string; callbackURL?: string; errorCallbackURL?: string; newUserCallbackURL?: string } }`. Retour : `{ token: string; user: { id; createdAt; updatedAt; email; emailVerified; name; image? } }`.
- `signOut(data?)` (`:1451-1459`) — retour `{ status/success: boolean }` (`{ success: boolean }` dans le type).
- `useSession()` (`:2075-2110`) — hook React : `{ data: { user, session } | null, isPending, isRefetching, error, refetch }`.

Côté serveur, `auth.signIn.magicLink(...)` et `auth.magicLink.verify(...)` existent aussi : `createApiProxy` (`dist/next/server/index.mjs:919-933`) construit dynamiquement l'objet à partir de `API_ENDPOINTS`, où figurent `signIn.magicLink → POST sign-in/magic-link` (`dist/next/server/index.d.mts:260-263`) et `magicLink.verify → GET magic-link/verify` (`:485-490`).

### Ce que fait le composant officiel `MagicLinkForm` (référence, pas à utiliser)

`node_modules/@neondatabase/auth-ui/dist/index.mjs:9098-9190`. Il valide l'email avec Zod, puis appelle :

```
authClient.signIn.magicLink({ email, callbackURL: getCallbackURL(), fetchOptions: { throw: true, headers } })
```

où `getCallbackURL()` produit une **URL absolue vers l'app** (`${baseURL}${basePath}/${viewPaths.CALLBACK}?redirectTo=…`). Puis il affiche un toast « email envoyé ». C'est la seule preuve directe, dans le paquet, de la forme attendue du `callbackURL` : absolu, pointant vers une route de callback de l'app.

### Next 16 — points vérifiés dans `node_modules/next/dist/docs/`

- `01-app/01-getting-started/16-proxy.md:15` : « Starting with Next.js 16, Middleware is now called Proxy ». `:35` : fichier `proxy.ts` à la racine du projet **ou dans `src/`**. `:41-57` : export `default` **ou** export nommé `proxy`, plus un `export const config = { matcher }` optionnel.
- `01-app/03-api-reference/03-file-conventions/proxy.md:75` : **sans `matcher`, le proxy s'exécute sur toutes les requêtes**, y compris `_next/static`, `_next/image` et `public/` — d'où le matcher négatif recommandé.
- Même fichier `:223` : « Proxy defaults to using the Node.js runtime. The `runtime` config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error. »
- Même fichier `:217-219` : les Server Functions sont des POST sur la route où elles sont utilisées ; un `matcher` qui exclut un chemin retire aussi la couverture du proxy sur ces Server Functions. « Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone. »
- `01-app/03-api-reference/03-file-conventions/route.md:87` : `{ params }: { params: Promise<{ team: string }> }` — params asynchrones, conforme à la signature exposée par `authApiHandler`.
- `01-app/03-api-reference/04-functions/cookies.md:66` : `cookies()` est asynchrone. `:72` : « HTTP does not allow setting cookies after streaming starts, so you must use `.set` in a Server Function or Route Handler ». `:79` : « Setting cookies is not supported during Server Component rendering. »
- `01-app/03-api-reference/06-cli/next.md:72-75` : `next dev --experimental-https` (+ `--experimental-https-key/-cert/-ca`) existe.
- `01-app/02-guides/authentication.md:1031` et `:1119` : le proxy sert aux vérifications optimistes, il ne doit pas être l'unique ligne de défense ; les contrôles doivent vivre au plus près de la donnée.

### Drizzle 0.45.2 — utile seulement pour préparer s03

`node_modules/drizzle-orm/pg-core/schema.d.ts:22` : `export declare function pgSchema<T extends string>(name: T): PgSchema<T>`. C'est le mécanisme qui permettra de **déclarer** une table du schéma `neon_auth` côté types sans la faire gérer par les migrations (`drizzle.config.ts` fixe déjà `schemaFilter: ["public"]`). s02 n'a pas à créer de table.

---

## Traps & constraints

### 1. s01 n'est pas livré — c'est la contrainte n°1

`src/` contient le template `create-next-app` intact : ni route API, ni proxy, ni client base, ni déploiement constaté, ni branche `feature/s01-deploy-skeleton`. Or l'AC 6 de s02 (« la route protégée de s01 répond en succès avec une session valide, et continue de répondre 401 sans session ») **teste un artefact de s01**. De même, l'AC 7 (« l'utilisateur existe en base ») suppose la base joignable, ce que prouve la route de santé de s01.

À trancher au planning : soit s01 est exécutée avant, soit s02 absorbe explicitement les livrables manquants — ce qui change son périmètre et sa complexité. **Ce n'est pas un choix d'implémentation, c'est une décision d'ordonnancement.**

### 2. Le middleware redirige (302), il ne renvoie jamais 401 — collision frontale avec l'AC 6

`processAuthMiddleware` ne connaît qu'une seule sanction : `redirect_login` (`dist/next/server/index.mjs:1563-1566`). Si le `matcher` de `src/proxy.ts` couvre `/api/**`, une requête non authentifiée sur la route protégée de s01 recevra **une redirection HTML vers `/auth/sign-in`, pas un 401**. L'AC 6 casse, et un client `fetch` recevrait du HTML.

Le 401 doit donc être produit par la route handler elle-même, à partir de `auth.getSession()`, et le matcher du proxy doit exclure les routes d'API (tout en laissant `/api/auth/**` fonctionner — il est de toute façon dans `SKIP_ROUTES`). Attention à ne pas surcorriger : voir § 4, l'échange de session a besoin que le proxy couvre la route de retour du lien.

### 3. `SKIP_ROUTES` est en dur — les chemins d'auth sont imposés

`dist/next/server/index.mjs:1572-1579`. Aucune option de configuration ne permet d'y ajouter une route publique (par exemple la route de santé de s01). Les seuls leviers sont `loginUrl` et le `matcher` du proxy.

Conséquence pratique : placer l'écran de connexion ailleurs que sous `/auth/sign-in` oblige à passer `loginUrl` en cohérence, et prive des autres chemins déjà exemptés (`/auth/callback` notamment, qui est le candidat naturel pour la route de retour du magic link).

Second effet : la comparaison est un `pathname.startsWith(route)` — `/auth/callback-truc` serait aussi exempté. Sans importance ici, mais à ne pas oublier en nommant les routes.

### 4. Les cookies sont `__Secure-` et `Secure: true` — HTTPS obligatoire, y compris en dev

Préfixe `__Secure-neon-auth` (`:290`) et `secure: true` forcé (`:333`, `:568`, `:603`, `:1559`). Le préfixe `__Secure-` impose au navigateur de rejeter le cookie s'il n'est pas posé depuis une origine sécurisée. Le comportement exact sur `http://localhost` varie selon les navigateurs et n'a **pas pu être vérifié ici** (aucun serveur Neon Auth joignable). Le levier existe et est documenté : `next dev --experimental-https` (`06-cli/next.md:72`).

À vérifier au plus tôt : c'est le genre de piège qui fait perdre une demi-journée à croire que la session « ne marche pas », alors que le cookie n'est simplement jamais stocké. Le `webServer` de `playwright.config.ts` lance `npm run dev` en HTTP simple — si le HTTPS local est nécessaire, cette configuration devra suivre.

### 5. `sameSite: 'strict'` par défaut sur le retour du magic link

`SessionCookieConfig.sameSite` vaut `'strict'` par défaut (`dist/next/server/index.d.mts:93`), et le JSDoc précise que `'lax'` était « previous hard-coded behavior ». Or le magic link est cliqué depuis un client mail : c'est une navigation top-level cross-site. Un cookie `SameSite=Strict` **n'est pas renvoyé** sur ce type de navigation.

Le mécanisme d'échange du § « Échange de session » a besoin du cookie de challenge (`…session_challange`) sur cette première requête de retour. Si ce cookie est `Strict`, `needsSessionVerification` renverra `false` et la session ne se matérialisera pas.

**Non vérifiable sans instance Neon Auth réelle.** À tester en priorité ; le repli est `cookies.sameSite: 'lax'`, qui est explicitement supporté et correspond au comportement historique du SDK.

### 6. `auth.getSession()` dans un Server Component peut lever une exception

`createNextRequestContext` (`dist/next/server/index.mjs:1005-1026`) expose un `setCookie` qui appelle `cookieStore.set(...)`. Et `fetchWithAuth` (`:877-889`) appelle ce `setCookie` **dès que la réponse upstream porte des `Set-Cookie`** — ce qui arrive lors d'un rafraîchissement de session.

Or Next 16 interdit `cookies().set()` pendant le rendu d'un Server Component (`04-functions/cookies.md:72` et `:79`). Le SDK documente d'ailleurs lui-même que les Server Components utilisant `auth` doivent être rendus dynamiquement (`export const dynamic = 'force-dynamic'`, `dist/next/server/index.d.mts:616-624`), mais cela ne règle pas le problème de l'écriture de cookie.

En pratique, le chemin « cache de cookie valide » (§ APIs vérifiées) court-circuite l'appel réseau et évite l'écriture — c'est le cas nominal. Le cas dégradé (cache expiré, rafraîchissement) est celui qui peut lever. Les lieux sûrs pour rafraîchir la session sont le proxy, une route handler et une Server Action.

### 7. Le cache de session en cookie retarde l'effet d'une déconnexion distante

`sessionDataTtl` vaut 300 s par défaut. Tant que le cookie `…local.session_data` est valide **et** que `…session_token` est présent, `getSession()` retourne le payload du cookie sans consulter Neon (`:891-912`). Une session révoquée côté serveur reste donc « valide » localement jusqu'à expiration du cache.

Pour l'AC 5 (« un rechargement ne restaure pas la session terminée »), le `signOut()` passe par le proxy `/api/auth` et les `Set-Cookie` de suppression sont répercutés — le cas nominal fonctionne. Le risque est sur les tests indirects et sur toute déconnexion qui ne passerait pas par le SDK. Baisser `sessionDataTtl` est une option ; le déclarer explicitement plutôt que de subir le défaut est le minimum.

### 8. `createNeonAuth` lève au chargement du module si le secret est absent ou court

`validateCookieConfig` (`:1037-1041`) est appelée **à la construction**, pas au premier appel : `secret` manquant ou < 32 caractères ⇒ `throw`. Comme `src/lib/auth.ts` sera importé par `src/proxy.ts`, un `.env` incomplet fera échouer toute requête, y compris le rendu de l'écran de connexion. Générer le secret avec `openssl rand -base64 32` (la doc du SDK le dit, `dist/next/server/index.d.mts:56-63`).

### 9. Les composants UI officiels de Neon Auth sont hors design system

`@neondatabase/auth/react/ui` réexporte `@neondatabase/auth-ui` : `MagicLinkForm`, `AuthView`, `AuthCallback`, `SignInForm`, `NeonAuthUIProvider`, `UserButton`… (`dist/react/ui/index.d.mts`). Ces composants embarquent leur propre CSS (`@neondatabase/auth-ui/css` ou `/tailwind`, `llms.txt:316-323`), leur propre système de tokens (`theme.css`, `theme-inline.css`) et leurs propres textes anglais.

`docs/design-system.md` est catégorique : la seule source visuelle du projet, ce sont le preset shadcn `radix-nova` et les trois décisions morpho. Utiliser `MagicLinkForm` importerait une seconde source de vérité visuelle et une seconde famille de tokens. **L'écran de connexion se construit avec les primitives shadcn**, en appelant `authClient.signIn.magicLink(...)` directement — le code de `MagicLinkForm` lu ci-dessus sert de référence de comportement, pas de composant à monter.

### 10. Aucun composant shadcn n'est installé — l'installation fait partie du travail

`src/components/ui/` n'existe pas. Pour cette story, le design system (`docs/design-system.md` § Composants disponibles) désigne :

- `button` — « Actions : enregistrer, se connecter, se déconnecter » — marqué **s02+** ;
- `input` — « Champs de mesure et email » — marqué **s02** ;
- `spinner` — « Chargement court dans un bouton » — marqué **s02**.

Mais le § Patterns UI imposés est tout aussi contraignant : « Un champ = un `field` (libellé + contrôle + zone de message). **Jamais un `input` nu.** » et « Erreurs **par champ**, sous le champ ». Or `field` et `label` sont tabulés s02… non, ils sont tabulés **s03** dans la table des composants. **Incohérence interne du design system à lever au planning** : le pattern impose `field` + `label` dès le premier formulaire, qui est celui de s02. Les deux composants existent bien au registre (200 vérifiés) — ce n'est pas un *gap*, juste une ligne de tableau à corriger.

### 11. L'état « lien envoyé » n'a pas de traitement défini dans le design system

Le § États couvre Vide / Chargement / Erreur / Succès, et associe le succès à un toast `sonner` (marqué s03). Mais l'AC 2 demande d'« afficher un état "lien envoyé" » : c'est un changement d'état d'écran persistant (l'utilisateur va quitter l'app pour son client mail), pas une confirmation fugace. Un toast ne suffit pas.

De même, l'AC de la note de story « prévoir le cas du lien expiré ou déjà consommé : un message clair, pas une page blanche » n'a pas d'écran ni de composant attribué.

Ces deux points relèvent de `/ks-design s02` et, s'ils ne se composent pas avec l'existant, d'un *design system gap* à remonter dans `docs/design-system.md`. Ne rien improviser.

### 12. Thème sombre inopérant et page template à remplacer

`@custom-variant dark (&:is(.dark *))` exige la classe `.dark` sur `<html>`, que rien ne pose (§ État actuel). Le design system impose de vérifier chaque écran « en clair **et** en sombre ». s02 livrant le premier écran réel, soit le script de thème arrive avec s01, soit s02 hérite du sujet. `src/app/page.tsx` (template Vercel, couleurs en dur `bg-zinc-50`, `bg-[#383838]`) doit disparaître : il viole « pas de couleur en dur » et « pas de valeur arbitraire ».

### 13. Tests : socle vide, et deux interdits

Aucun test n'existe. `vitest.config.ts` ne ramasse que `src/**/*.test.{ts,tsx}` en jsdom ; les e2e vivent dans `tests/e2e/` (dossier à créer) et Playwright lance `npm run dev` sauf si `E2E_BASE_URL`. `npx playwright install` n'a jamais été lancé sur cette machine (à vérifier au moment d'exécuter).

Deux règles d'AGENTS.md à ne pas oublier : **ne jamais installer `@vitejs/plugin-react`** (il tire `@babel/core@8.0.0-rc` et casse `shadcn`) ; `npm run check` = `typecheck && lint && test` est la commande de la review.

Difficulté propre à cette story : **le flux magic link n'est pas testable de bout en bout sans boîte mail**. Il n'y a pas, dans le paquet, de mode « retourner le lien dans la réponse » ni de hook de développement. Ce qui reste testable sans Neon réel : la validation d'email côté client, le rendu des états de l'écran, la logique de garde d'une route handler face à un `getSession()` mocké. Le reste (envoi, clic, session, déconnexion) exige une instance Neon Auth configurée.

### 14. L'AC 8 se joue au niveau des handlers, pas du proxy

« L'identité provient du token vérifié, jamais d'un identifiant envoyé par le client. » La doc Next elle-même prévient (`02-guides/authentication.md:1119`, `03-file-conventions/proxy.md:217-219`) qu'un `matcher` mal réglé ou un déplacement de Server Function retire silencieusement la couverture du proxy. La vérification doit donc être **dans chaque handler**, via `auth.getSession()`, avec `session.data.user.id` comme unique source d'identité. Le proxy est une commodité de redirection, pas le contrôle d'accès.

Le test de forgery demandé par l'AC 8 n'a rien à mocker de subtil : il consiste à prouver qu'aucun paramètre client (`?user_id=`, corps JSON, en-tête) n'influence l'identité retenue.

### 15. Coût réseau du proxy sur chaque navigation authentifiée

Quand le cookie `session_token` est présent, le middleware appelle `get-session` en amont (`:1517-1544`) — même s'il bénéficie du cache cookie côté handler proxy. Sur mobile, avec le budget de 20 secondes de s05 et le cold start Neon de ~500 ms évoqué au PRD, un `matcher` trop large (assets, images, prefetch de routes) multiplie ces appels. Le matcher négatif recommandé par la doc Next (`03-file-conventions/proxy.md:75`) n'est pas une optimisation cosmétique ici.

### 16. Neon Auth doit être configuré côté console — invisible depuis le dépôt

Le paquet est un **proxy vers un serveur Neon Auth** : il n'envoie aucun email lui-même. L'activation du provider magic link, le gabarit d'email, l'expiration du lien et la liste des URLs de callback autorisées sont des réglages de la console Neon. Rien dans le dépôt ne les documente, et aucune CLI Neon n'est disponible ici. À l'image de la Root Directory Vercel (point ouvert n°4 de `docs/architecture.md`), ce sont des réglages à consigner dans la review.

---

## Open questions

1. **Nom réel de la table de synchronisation dans le schéma `neon_auth`, et sa clé primaire.** C'est la question que `docs/architecture.md` (point ouvert n°1) et l'[ADR 003](../decisions/003-neon-auth.md) assignent nommément à cette Research. **Je ne peux pas y répondre honnêtement.** Ce que j'ai vérifié : une recherche de `neon_auth` et `users_sync` sur tout `node_modules/@neondatabase/**` (`.mjs`, `.d.mts`, `.md`, `.txt`, `.json`) ne remonte **qu'une seule occurrence**, sans rapport : `NEON_AUTH_SESSION_VERIFIER_PARAM_NAME = "neon_auth_session_verifier"` (`dist/better-auth-helpers-Bkezghej.mjs:19`). Le SDK ne connaît pas le schéma SQL : il parle HTTP à un serveur distant. Le guide `NEXT-JS.md` référencé par le README **n'est pas publié dans le paquet** (le champ `files` de `package.json` ne contient que `codemods/`, `dist`, `llms.txt`, `sbom.cdx.json`). Sans `DATABASE_URL` ni CLI Neon, il n'y a aucun moyen de l'établir depuis cet environnement. **Ne pas deviner ce nom.** Il se lit en une requête, une fois la base joignable : `SELECT table_name FROM information_schema.tables WHERE table_schema = 'neon_auth';` puis `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='neon_auth' AND table_name='<table>';`. Tant que ce n'est pas fait, s03 ne peut pas écrire sa clé étrangère.
2. **Où pointe l'URL contenue dans l'email ?** Vers `<NEON_AUTH_BASE_URL>/magic-link/verify?token=…&callbackURL=…`, ou vers l'app ? Le SDK expose les deux faces (`magicLink.verify` en client et en serveur, `callbackURL` absolu vers l'app dans `MagicLinkForm`), et le mécanisme `neon_auth_session_verifier` + cookie de challenge suggère fortement un aller-retour par le serveur Neon puis un retour sur l'app intercepté par le proxy. **Suggère ne suffit pas** : ça se constate avec un vrai email, et ça détermine la route de retour à créer et le contenu du `matcher`.
3. **`sameSite: 'strict'` survit-il au clic depuis un client mail ?** (Traps § 5.) Si non, `'lax'` est le réglage à documenter — idéalement dans un ADR, puisque c'est un arbitrage de sécurité.
4. **Le préfixe `__Secure-` passe-t-il sur `http://localhost:3000` ?** Si non, `next dev --experimental-https` devient obligatoire et `playwright.config.ts` doit suivre. À constater, pas à supposer.
5. **Comment tester le flux de bout en bout ?** Aucun mécanisme de capture du lien n'existe dans le paquet. Boîte mail jetable pilotable par API, adresse dédiée, ou tests e2e limités aux états d'écran avec le flux réel vérifié manuellement et consigné dans la review ? La question rejoint le point ouvert n°2 de l'architecture (base de test pour s03) et mérite d'être tranchée une fois pour les deux.
6. **s01 est-elle exécutée avant s02, ou s02 absorbe-t-elle son périmètre ?** (Traps § 1.) Décision d'ordonnancement, pas d'implémentation.
7. **L'instance Neon Auth existe-t-elle déjà** (projet Neon créé, magic link activé, gabarit d'email, URLs de callback autorisées) ? Invérifiable ici.
8. **`field`/`label` en s02 ou s03 ?** (Traps § 10.) Correction mineure de `docs/design-system.md` à acter.
9. **Quel traitement pour l'état « lien envoyé » et pour le lien expiré/consommé ?** (Traps § 11.) À sortir de `/ks-design s02`, éventuellement en remontant un *design system gap*.
10. **Le shell (classe `.dark`, `lang="fr"`, métadonnées, famille typographique raccordée) arrive-t-il avec s01 ou avec s02 ?**

---

## Blockers

Rien de ce qui suit n'est contournable par du code :

- **Aucune credential.** Pas de `DATABASE_URL`, pas de `NEON_AUTH_BASE_URL`, pas de `NEON_AUTH_COOKIE_SECRET`, pas de `.env`, pas de CLI Neon, pas de CLI Vercel. Aucun appel à un serveur Neon Auth réel n'a pu être fait, et aucune requête SQL non plus.
- **Le nom de la table `neon_auth` reste inconnu** et n'est pas déductible du code (Open questions § 1). L'[ADR 003](../decisions/003-neon-auth.md) l'exigeait de cette phase : l'exigence n'est pas satisfaite, et elle ne peut pas l'être sans accès base.
- **s01 n'est pas implémentée** : deux critères d'acceptation de s02 (AC 6 et, partiellement, AC 7) portent sur des artefacts qui n'existent pas.
- **Le flux magic link n'est pas testable sans instance Neon Auth configurée et sans boîte mail atteignable.** Les AC 2, 3, 4 et 5 ne sont vérifiables de bout en bout qu'à cette condition.
