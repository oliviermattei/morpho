# Research — Story s09-edit-delete-session

> Phase `/ks-research` du pipeline killer-saas. **Aucun code, aucun plan** : uniquement du contexte vérifié, fichier ouvert à l'appui.
> Chemins relatifs à `multitool/morpho/` sauf mention contraire. Format des références : `chemin:ligne`.
> Méthode : inventaire réel de `src/`, lecture de `node_modules/next/dist/docs/**` pour Next 16.2.12, de `node_modules/drizzle-orm/**` pour l'ORM, de `node_modules/@neondatabase/{auth,serverless}/**` pour l'auth et le driver, et interrogation HTTP du registre shadcn `radix-nova`. Ce qui n'a pas pu être établi est en « Open questions » / « Blockers », pas déguisé en fait.

---

## Target story

**Story s09-edit-delete-session — Corriger une saisie**
**As a** utilisateur **I want** modifier ou supprimer une session **so that** une erreur de frappe ne pollue pas mes courbes.

Complexity : 2.

### Acceptance criteria (verbatim, `docs/stories.md` l. 240-246)

- [ ] Une session de la liste d'historique s'ouvre en édition, pré-remplie avec ses valeurs réellement enregistrées.
- [ ] Modifier une valeur et enregistrer met à jour la session existante sans en créer une nouvelle : le nombre total de sessions est inchangé.
- [ ] Vider un champ en édition supprime cette mesure de la session au lieu de la mettre à zéro.
- [ ] Supprimer une session demande une confirmation explicite avant d'agir.
- [ ] Une session supprimée disparaît de l'historique, de la silhouette et des graphes.
- [ ] Éditer ou supprimer une session appartenant à un autre utilisateur est refusé côté serveur, vérifié par un test d'accès croisé.
- [ ] Les deltas de la silhouette et les courbes reflètent la correction, y compris quand la session modifiée était la première ou la dernière de l'historique.

### Dependencies déclarées

s03 (les sessions et leur liste existent), s06 et s07 (ce sont les vues à réévaluer après correction).

### Notes agentiques attachées (`docs/stories.md` l. 252-254)

- Cas limite explicite : corriger ou supprimer la **première** session change le référentiel de tous les deltas de s06. « Une implémentation qui mémorise la première mesure quelque part se désynchronise ici. »
- La suppression est **définitive, sans corbeille**. Un choix inverse exige un ADR.
- Le pré-remplissage en édition affiche les valeurs **réellement enregistrées**, y compris les champs vides — à ne pas confondre avec le pré-remplissage « dernière valeur connue » de s05, sur le même formulaire. **C'est le piège désigné de la story.**

---

## Current state of the code

### Inventaire réel

`find src tests drizzle -type f` (exécuté ce jour) :

```
src/app/favicon.ico
src/app/globals.css
src/app/layout.tsx
src/app/page.tsx
src/lib/utils.ts
```

Cinq fichiers. Les répertoires `src/lib/db/` et `tests/e2e/` **existent mais sont vides**. `git status --short` ne montre que `?? morpho/docs/research/`.

**Aucune story n'est implémentée.** `git branch -a` : `main` seule (plus une branche distante sans rapport, `claude/deploy-leasing-km-tracker-coolify-fbsfpm`). Derniers commits : `8a3f73b docs: design system`, `d4628fb docs: architecture`, `ee4ef53 docs: stories review — pass 2`. Aucune branche `feature/s0*`, aucun commit de code applicatif.

Tout ce dont s09 dépend est absent :

| Attendu par s09 | Livré par | État réel |
|---|---|---|
| Liste d'historique des sessions | s03 | n'existe pas |
| Formulaire de saisie (à réutiliser en édition) | s03 / s05 | n'existe pas |
| `src/lib/db/schema.ts` (`measurement_sessions`, `measurements`, enum `kind`) | s03 | n'existe pas ; `drizzle/` non plus |
| Client Neon + instance Drizzle (`src/lib/db/index.ts`) | s01 / s03 | n'existe pas |
| `src/lib/auth.ts` (`createNeonAuth`) | s02 | n'existe pas |
| `src/proxy.ts` | s02 | n'existe pas |
| Silhouette (vue à réévaluer, AC 5 et 7) | s06 | n'existe pas |
| Graphes (vue à réévaluer, AC 5 et 7) | s07 | n'existe pas |
| `src/components/` et `src/components/ui/` | s02+ | **les deux répertoires n'existent pas** — aucun composant shadcn installé |
| Migration / base joignable | s01 / s03 | aucune |

`docs/research/` contient aujourd'hui `s01`, `s02`, `s04`, `s05`, `s06`. **`docs/research/s03-log-measurement-session.md` n'existe pas** : la story dont s09 dépend le plus directement (schéma, liste, formulaire, base de test) n'a pas encore été explorée. `docs/plans/`, `docs/designs/`, `docs/decisions/` côté story : aucun fichier de plan ni de design.

### État des commandes, mesuré

- `npm run build` : **OK**, ~1,3 s (Next.js 16.2.12, Turbopack). Routes générées : `/` et `/_not-found`, toutes deux `○ (Static)`.
- `npm run typecheck` (`tsc --noEmit`, et re-testé en `--incremental false`) : **OK**, aucune erreur.
- `npm run test` : **ÉCHOUE** — `No test files found, exiting with code 1`. Donc `npm run check` est **rouge avant toute modification**. Avertissement Vitest au passage : `Your Vite config uses features that are unsupported by configLoader: 'native'` (ESM dans `vitest.config.ts` chargé en CJS) — bruit, non bloquant.
- Navigateurs Playwright installés (`~/Library/Caches/ms-playwright`) : `chromium-1228`, `chromium_headless_shell-1228`, `ffmpeg-1011`. **Pas de webkit**, alors que `devices["iPhone 13"].defaultBrowserType === "webkit"` (projet `mobile`).

### Configuration en place (vérifiée)

| Fichier | Contenu utile pour s09 |
|---|---|
| `package.json` | `next 16.2.12`, `react 19.2.4`, `drizzle-orm ^0.45.2`, `@neondatabase/serverless ^1.1.0`, `@neondatabase/auth ^0.4.2-beta`, `zod ^4.4.3`, `radix-ui ^1.6.7`, `lucide-react ^1.28.0`, `shadcn ^4.16.1`. `check` = `typecheck && lint && test`. |
| `next.config.ts` | **vide** → `cacheComponents` désactivé, `experimental.authInterrupts` désactivé, `experimental.staleTimes` non réglé. |
| `drizzle.config.ts` | `dialect: "postgresql"`, `schema: "./src/lib/db/schema.ts"` (absent), `out: "./drizzle"`, `url: process.env.DATABASE_URL!`, `schemaFilter: ["public"]`. |
| `components.json` | `style: "radix-nova"`, `baseColor: "neutral"`, `rsc: true`, `iconLibrary: "lucide"`, alias `@/components/ui`, `@/lib`. |
| `vitest.config.ts` | `environment: "jsdom"`, `setupFiles: ["./vitest.setup.ts"]`, `include: ["src/**/*.test.{ts,tsx}"]`, alias `@` → `./src`. |
| `playwright.config.ts` | `testDir: "./tests/e2e"`, projets `mobile` (iPhone 13) et `desktop`, `webServer: npm run dev` sauf si `E2E_BASE_URL`. |
| `tsconfig.json` | `strict: true`, `jsx: "react-jsx"`, `paths: { "@/*": ["./src/*"] }`, `include` couvre `.next/types/**/*.ts`. |
| `.env.example` | `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `E2E_BASE_URL`. Aucune valeur, aucun `.env`. |

### Design system : ce qui est déjà câblé

`src/app/globals.css` porte bien les tokens de `docs/design-system.md` (relevés par les recherches s02/s05/s06 et cohérents avec ce que j'ai lu) : `--progress-favorable` / `--progress-adverse` (`:root` et `.dark`), `--label-min-size: 0.75rem`, mapping `@theme inline` (`--color-progress-*`, `--text-label-min`), et `@custom-variant dark (&:is(.dark *))`. **Rien ne pose la classe `dark` sur `<html>`** : `src/app/layout.tsx` est encore le layout `create-next-app` (`lang="en"`, `title: "Create Next App"`). Le thème sombre est donc inatteignable aujourd'hui — tâche attribuée au shell (s01) par `docs/design-system.md` § Thème.

---

## Anchor points

Aucun point d'ancrage n'existe : s09 se greffe intégralement sur du code que s03, s06 et s07 doivent livrer. Les emplacements ci-dessous sont **imposés** par les conventions du dépôt (`AGENTS.md`, `docs/architecture.md`) ou par le framework, pas choisis librement.

| Point de branchement | Emplacement | Contrainte qui l'impose | État |
|---|---|---|---|
| Liste d'historique (l'entrée en édition) | composant + route livrés par s03 | AC 1 | **inexistant** |
| Écran d'édition d'une session | segment dynamique sous `src/app/`, ex. `…/[id]/…` | AC 1 ; c'est **le premier segment dynamique du projet** (voir Traps § 9) | **inexistant** |
| Formulaire réutilisé en édition | `src/components/<Form>.tsx` (PascalCase), déjà `"use client"` | `docs/architecture.md` § Composants | **inexistant** (s03) |
| Lecture d'une session par id **et** par propriétaire | module de lecture sous `src/lib/db/` (kebab-case) | `AGENTS.md` : « Identity comes from `auth.getSession()` » | **inexistant** |
| Mutation « mettre à jour » | Server Action (`"use server"`) **ou** route handler `PATCH` sous `src/app/api/` | à trancher — même question ouverte qu'en s04 | **inexistant** |
| Mutation « supprimer » | idem, `DELETE` | AC 4 et 6 | **inexistant** |
| Validation du payload d'édition | même module Zod que s03 (plages physiologiques par `kind`, **en un seul endroit**) | `AGENTS.md` + `docs/architecture.md` § Validation | **inexistant** |
| Boîte de confirmation de suppression | `src/components/ui/alert-dialog.tsx` (généré CLI) + un composant client dans `src/components/` | `docs/design-system.md` : « Action destructive (supprimer une session) → `alert-dialog`, avec le contenu concerné nommé dans le texte » | **à installer** |
| Ligne d'historique | `src/components/ui/item.tsx` (+ `separator`) | `docs/design-system.md` tableau des composants, ligne `item` | **à installer** (s03) |
| Toast de confirmation | `src/components/ui/sonner.tsx` | `docs/design-system.md` § Feedback | **à installer** (s03) |
| Invalidation des vues (silhouette, graphes, historique) | `revalidatePath()` / `refresh()` depuis `next/cache`, dans la mutation | AC 5 et 7 | **inexistant** |
| Déclaration FK `measurements.session_id` | `src/lib/db/schema.ts` (s03) | conditionne la suppression en cascade (voir Traps § 6) | **inexistant** |
| Tests logique / composants | `src/**/*.test.ts(x)` co-localisés | ADR 005 | aucun |
| Tests navigateur | `tests/e2e/` | ADR 005 | répertoire vide |

**Composants shadcn à installer pour cette story** (aucun n'est présent) : `alert-dialog` (tire `button`), et selon ce que s03 aura déjà posé, `item` (tire `separator`), `button`, `input`, `label`, `field`, `sonner`.

---

## Verified APIs / functions

### Le driver Neon HTTP **ne supporte pas les transactions** — le fait le plus structurant de cette story

`node_modules/drizzle-orm/neon-http/session.js` :

```
151:  async transaction(_transaction, _config = {}) {
152:    throw new Error("No transactions support in neon-http driver");
157:  async transaction(_transaction) {
158:    throw new Error("No transactions support in neon-http driver");
```

Ce qui existe à la place, sur le même driver — `neon-http/session.js:117-132` et `neon-http/driver.d.ts:27` :

```ts
batch<U extends BatchItem<'pg'>, T extends Readonly<[U, ...U[]]>>(batch: T): Promise<BatchResponse<T>>;
```

`session.js:131` montre que `batch()` délègue à `this.client.transaction(builtQueries, queryConfig)`, c'est-à-dire la transaction **non interactive** du driver HTTP de Neon. Confirmé côté paquet Neon, `node_modules/@neondatabase/serverless/index.d.ts:853-884` :

> « The `transaction()` function allows multiple queries to be submitted (over HTTP) as a single, non-interactive Postgres transaction. »

signature : `transaction(queriesOrFn: NeonQueryPromise[] | ((sql) => NeonQueryInTransaction[]), opts?: HTTPTransactionOptions)`, avec `isolationLevel`, `readOnly`, `deferrable` (`index.d.ts:476-492`).

L'alternative interactive existe : `drizzle-orm/neon-serverless` (`neon-serverless/session.js:178` et `:198` implémentent réellement `transaction`), qui repose sur `Pool` de `@neondatabase/serverless` via WebSocket (`neon-serverless/driver.js:1`). Coût : `@neondatabase/serverless/index.d.ts:640-651` — « Only if no global `WebSocket` object is available, such as in older versions of Node, set `webSocketConstructor` ».

**Conséquence pour s09** : une édition qui touche plusieurs lignes `measurements` (supprimer les mesures vidées, insérer/mettre à jour les autres) n'est atomique que par `db.batch([...])` (driver HTTP) ou en basculant sur `neon-serverless`. Un enchaînement de `await` séparés laisse la porte ouverte à une session à moitié corrigée. Le choix du driver est probablement fait par s01/s03 : à vérifier avant de planifier.

### Drizzle ORM 0.45.2 — écriture

`node_modules/drizzle-orm/pg-core/db.d.ts` :

```
227:  update<TTable extends PgTable>(table: TTable): PgUpdateBuilder<TTable, TQueryResult>;
252:  insert<TTable extends PgTable>(table: TTable): PgInsertBuilder<TTable, TQueryResult>;
277:  delete<TTable extends PgTable>(table: TTable): PgDeleteBase<TTable, TQueryResult>;
281:  transaction<T>(transaction: (tx: PgTransaction<…>) => Promise<T>, config?: PgTransactionConfig): Promise<T>;
```

`db.d.ts:203` avertit explicitement : « Calling this method without `.where()` clause will update all rows in a table. » Idem pour `delete` (`:256`). Sur une story dont l'AC 6 est un test d'accès croisé, un `.where()` oublié est la faute qui coûte cher.

- **Upsert** — `pg-core/query-builders/insert.d.ts:171` : `onConflictDoUpdate(config: PgInsertOnConflictDoUpdateConfig<this>)`, dont la forme est `{ target: IndexColumn | IndexColumn[]; set: …; targetWhere?: SQL; setWhere?: SQL }` (`:62-66`). `onConflictDoNothing` en `:138`. C'est le mécanisme naturel pour la contrainte d'unicité `(session_id, kind)` posée par l'[ADR 004](../decisions/004-measurements-as-rows.md).
- **`returning()`** disponible sur `insert` (`:114`), `update` (`:71`) et `delete` (`:22`) — utile pour prouver qu'une ligne a bien été touchée, donc pour distinguer « refusé » de « inexistant ».
- **Conditions** — `sql/expressions/conditions.d.ts` : `and` (`:63`), `or` (`:80`), `inArray` (`:169-171`), `notInArray` (`:187-189`), `isNull` (`:206`). `eq`, `asc`, `desc` déjà relevés par les recherches s05/s06.
- **Cascade** — `pg-core/foreign-keys.d.ts:4` : `type UpdateDeleteAction = 'cascade' | 'restrict' | 'no action' | 'set null' | 'set default'`, exposé par `onDelete(action)` (`:22`) et par `references(ref, actions?)` sur le column builder (`pg-core/columns/common.d.ts:45`).
- **`numeric`** — rappel vérifié en s05/s06 et re-confirmé : sans `mode: "number"`, `PgNumeric.mapFromDriverValue` renvoie une **chaîne**. `numeric("value", { mode: "number" })` est la forme à utiliser (`pg-core/columns/numeric.d.ts`).
- **`selectDistinctOn`** — `pg-core/db.d.ts:198-199`. C'est la requête des deltas (s06, `ASC`) et du pré-remplissage (s05, `DESC`), que s09 doit laisser recalculer, jamais figer.

### Next.js 16.2.12 — segments dynamiques, mutations, invalidation

Docs lues dans `node_modules/next/dist/docs/01-app/`.

- **Segment dynamique** (`03-api-reference/03-file-conventions/dynamic-routes.md:20-28`, `:146`) : `params` est une **Promise**. `export default async function Page({ params }: { params: Promise<{ slug: string }> })`, puis `const { slug } = await params`. Dans un Client Component, `use(params)` ou `useParams()` (`:46-84`). Les valeurs sont typées `string` « because their values aren't known until runtime » (`:117`) — d'où la validation runtime recommandée (`:126-142`, exemple avec `notFound()`).
- **Helpers de types `PageProps` / `RouteContext`** (`dynamic-routes.md:115`, `route.md:107-121`) : **globaux générés**, pas fournis par le paquet. Vérifié : `node_modules/next/dist/esm/server/lib/router-utils/typegen.js:708-719` déclare `interface PageProps` dans un `declare global`, et le fichier produit après `npm run build` est `.next/types/routes.d.ts`, qui contient aujourd'hui :
  ```
  4: type AppRoutes = "/"
  12: interface ParamMap { "/": {} }
  37: interface PageProps<AppRoute extends AppRoutes> { params: Promise<ParamMap[AppRoute]>; … }
  ```
  `next-env.d.ts` fait `import "./.next/types/routes.d.ts"`. `RouteContext` n'apparaît dans ce fichier que lorsqu'un route handler existe. Le doc le dit noir sur blanc (`route.md:121`) : « After type generation, the `RouteContext` helper is globally available. »
- **Méthodes de route handler** (`route.md:24`) : `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. Signature avec params (`route.md:87`) : `{ params }: { params: Promise<{ team: string }> }`.
- **Server Actions** (`01-getting-started/07-mutating-data.md`) : directive `"use server"` en tête de fichier ou de fonction async ; invoquée par `<form action={…}>` ou `formAction` ; « Behind the scenes, actions use the `POST` method » (`:29`). Avertissement en encadré (`:31-33`) :
  > « Server Functions are reachable via direct POST requests, not just through your application's UI. Always verify authentication and authorization inside every Server Function. »
  Exemple canonique de `deletePost` avec commentaire « Verify the user owns this resource before deleting » (`:57-69`).
- **Autorisation et IDOR** (`02-guides/data-security.md:337-393`) : « A page-level authentication check does not extend to the Server Actions defined within it. Always re-verify inside the action » (`:339`) ; « Beyond authentication…, remember to check **authorization** … This prevents Insecure Direct Object Reference (IDOR) vulnerabilities » (`:370`), avec un exemple `deletePost(postId)` qui relit la ressource et compare `post.authorId !== session.user.id` avant de supprimer (`:378-392`). La checklist de revue du même document (`:609`) demande explicitement : « Does the action check ownership of the resource (authorization, not just authentication)? »
- **`revalidatePath`** (`04-functions/revalidatePath.md`) : `revalidatePath(path: string, type?: 'page' | 'layout'): void`. Appelable « in Server Functions and Route Handlers », **jamais** dans un Client Component ni dans le Proxy. Point capital pour s09 : « If `path` contains a dynamic segment, for example `/product/[slug]`, this parameter [`type`] **is required** ». Et la nuance route handler : « Marks the path for revalidation. The revalidation is done on the **next visit** ».
- **`refresh()`** (`04-functions/refresh.md`) : nouveauté Next 16, `refresh(): void`, importé de `next/cache`, « can **only** be called from within Server Actions. It cannot be used in Route Handlers, Client Components, or any other context. » `07-mutating-data.md:417` précise : « This refreshes the client router… `refresh()` does not revalidate tagged data. »
- **`redirect`** (`04-functions/redirect.md:51-62`) : lève un `NEXT_REDIRECT`, doit être appelé **hors** d'un `try/catch`, et par défaut en `push` dans une Server Action. `07-mutating-data.md:500` : « Any code after it won't execute. If you need fresh data, call `revalidatePath` or `revalidateTag` beforehand. » → **revalider puis rediriger**, jamais l'inverse.
- **`notFound()`** (`04-functions/not-found.md`) : lève `NEXT_HTTP_ERROR_FALLBACK;404`, rend le `not-found` du segment, pas de `return` nécessaire (type `never`).
- **`forbidden()`** (`04-functions/forbidden.md`) : marqué `version: experimental` et **exige** `experimental.authInterrupts: true` dans `next.config.ts` — aujourd'hui vide. Sans ce réglage, `forbidden()` n'est pas utilisable.
- **`useActionState`** (`07-mutating-data.md:339-370`) : `const [state, action, pending] = useActionState(createPost, initialState)`, pour l'état d'attente et les erreurs par champ. Le composant portant le `<form>` devient alors Client Component.
- **Client Cache / `staleTimes`** (`05-config/01-next-config-js/staleTimes.md`) : `dynamic` **vaut 0 par défaut depuis la v15** (non caché) ; `static` 5 min. Mais : « This doesn't change back/forward caching behavior » — un retour navigateur après suppression peut réafficher l'ancienne liste.
- **Rappels Next 16** confirmés par `AGENTS.md` et par les docs bundlées : `middleware.ts` → `proxy.ts`, Request APIs asynchrones, Turbopack par défaut, `next lint` supprimé (le `package.json` appelle bien `eslint`).

### Neon Auth 0.4.2-beta — ce qui est établi (revérifié ici)

`node_modules/@neondatabase/auth/dist/next/server/index.d.mts` :
- `:643` — `declare function createNeonAuth(config: NeonAuthConfig): NeonAuth;`
- `:620` — le JSDoc du paquet montre lui-même l'usage : `const { data: session } = await auth.getSession();`, précédé de `export const dynamic = 'force-dynamic'` pour tout Server Component utilisant `auth`.
- `:219` — `getSession` fait partie des `API_ENDPOINTS`, donc de la surface serveur.

Forme de l'identité (établie par les recherches s02/s06, via `better-auth` → `@better-auth/core/dist/db/schema/user.d.mts`) : **`session.data.user.id` est une `string`**. C'est l'unique source d'identité côté serveur pour l'AC 6.

**Nom de la table de synchronisation `neon_auth` : toujours introuvable.** `grep -rn "neon_auth|users_sync" dist/ llms.txt` ne remonte qu'une constante sans rapport, `NEON_AUTH_SESSION_VERIFIER_PARAM_NAME = "neon_auth_session_verifier"` (`dist/better-auth-helpers-Bkezghej.mjs:19`). Confirmation indépendante du constat de s02.

### shadcn / registre `radix-nova` — interrogé réellement (HTTP)

`https://ui.shadcn.com/r/styles/radix-nova/<item>.json` → **200** pour `alert-dialog`, `item`, `separator`, `button`, `input`, `label`, `field`, `skeleton`, `sonner`, `card`, `empty`.

| Item | `dependencies` npm | `registryDependencies` | Directive | Exports relevés dans le contenu réel |
|---|---|---|---|---|
| `alert-dialog` | aucune | `["button"]` | **`"use client"`** | `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogMedia`, `AlertDialogOverlay`, `AlertDialogPortal`, `AlertDialogTitle`, `AlertDialogTrigger` |
| `item` | aucune | `["separator"]` | aucune (Server Component possible) | `Item`, `ItemMedia`, `ItemContent`, `ItemActions`, `ItemGroup`, `ItemSeparator`, `ItemTitle`, `ItemDescription`, `ItemHeader`, `ItemFooter` |
| `separator` | aucune | aucune | **`"use client"`** | `Separator` |
| `sonner` | `["sonner", "next-themes"]` | aucune | — | — |

Détails vérifiés dans le code des items, qui conditionnent l'implémentation :

- `alert-dialog.tsx` importe `{ AlertDialog as AlertDialogPrimitive } from "radix-ui"` et `{ Button }`. **`AlertDialogAction` et `AlertDialogCancel` sont des `Button` avec `asChild`**, et acceptent `Pick<React.ComponentProps<typeof Button>, "variant" | "size">`. Défauts : `Action` → `variant="default"`, `Cancel` → `variant="outline"`.
- `buttonVariants` (item `button`) expose bien une variante **`destructive`** : `"bg-destructive/10 text-destructive hover:bg-destructive/20 …"` — c'est-à-dire un rouge **atténué sur fond translucide**, pas un bouton plein. Tailles : `default: h-8`, `xs: h-6`, `sm: h-7`, `lg: h-9`, `icon: size-8`.
- `Item` accepte **`asChild`** (via `Slot.Root` de `radix-ui`) et des variantes `default | outline | muted`, tailles `default | sm | xs`. `ItemGroup` porte `role="list"`. → une ligne d'historique cliquable s'exprime en `<Item asChild><Link …>`, et `ItemActions` accueille le bouton de suppression.
- `AlertDialogContent` accepte `size?: "default" | "sm"` ; `AlertDialogTitle` porte la classe `cn-font-heading` (classe repérée comme **sans effet** par la recherche s06 : introuvable dans `node_modules/shadcn/dist/tailwind.css`).

**Aucune dépendance npm supplémentaire n'est requise pour `alert-dialog`** : `node_modules/radix-ui/dist/index.d.ts:5-6` réexporte `@radix-ui/react-alert-dialog` sous le nom `AlertDialog`, et `:53-54` `@radix-ui/react-slot` sous `Slot` ; `@radix-ui/react-alert-dialog` figure dans les dépendances de `radix-ui@1.6.7`.

`lucide-react` est en **1.28.0** (vérifié par `require('lucide-react/package.json').version`). Icônes présentes, vérifiées par introspection du module : `Trash`, `Trash2`, `Pencil`, `PencilLine`, `SquarePen`, `TriangleAlert`, `X`, `Check`, `ChevronRight`.

### Zod 4.4.3

Rappel vérifié en s05 et valable pour la validation du payload d'édition : `ZodError.flatten()` et `.format()` sont annotés `@deprecated Use the z.treeifyError(err) function instead` (`node_modules/zod/v4/classic/errors.d.cts`). Les fonctions de remplacement sont `flattenError` (`v4/core/errors.d.cts:153`) et `treeifyError` (`:185`). Le guide `02-guides/forms.md` de Next montre du **Zod 3** : ne pas le recopier tel quel.

---

## Traps & constraints

### 1. s09 n'a aucun code d'accroche, et sa dépendance principale n'est même pas explorée

s01 à s08 ne sont pas implémentées ; il n'existe ni schéma, ni session, ni liste, ni formulaire, ni silhouette, ni graphe. Pire pour cette story : **`docs/research/s03-log-measurement-session.md` n'existe pas**. Or s03 tranche le schéma exact, la route de la liste, le nom du composant de formulaire, la base de test, et le driver Drizzle. Toute planification de s09 qui suppose ces éléments connus invente. C'est la contrainte n°1, et elle est d'ordonnancement, pas d'implémentation.

### 2. La collision de pré-remplissage — le piège désigné par la story

Le même formulaire porte deux mécaniques opposées :
- **s05, création** : chaque champ est pré-rempli avec la **dernière valeur connue par mesure**, toutes sessions confondues, et porte `data-prefilled="true"` jusqu'à la première modification.
- **s09, édition** : chaque champ porte la valeur **réellement enregistrée dans cette session**, et **un champ vide doit rester vide** (une mesure absente de la session est un fait, pas un manque à combler).

Si le composant hérite du comportement s05 en mode édition, un champ absent de la session se remplira avec la valeur d'une autre session, et l'utilisateur enregistrera une mesure qu'il n'a jamais prise. Le marqueur `data-prefilled` de s05 n'a **aucun sens** en édition et doit être absent — c'est un point testable, à ne pas laisser au hasard.

### 3. « Vider un champ » = supprimer une ligne, pas écrire un zéro (AC 3)

Trois transitions distinctes à couvrir sur le trajet formulaire → mutation → base :

| État initial | État soumis | Effet base attendu |
|---|---|---|
| mesure présente | champ modifié | mise à jour de la ligne `(session_id, kind)` |
| mesure présente | champ **vidé** | **suppression** de la ligne — ni `0`, ni `NULL` |
| mesure absente | champ rempli | insertion d'une ligne |
| mesure absente | champ laissé vide | rien |

C'est la variante s09 du piège central du PRD (`Number("")` → `0`). L'[ADR 004](../decisions/004-measurements-as-rows.md) le rappelle : en lignes, une mesure non saisie n'a **pas de ligne**. Un `set({ value: 0 })` ou un `set({ value: null })` casserait silencieusement les deltas et les axes de graphe — et l'erreur ne se verrait que des semaines plus tard.

### 4. « Sans en créer une nouvelle » interdit le raccourci delete-then-insert (AC 2)

Réimplémenter l'édition en supprimant la session puis en la recréant satisfait l'affichage mais viole l'AC : l'`id` change, le `created_at` change (donc le départage du `DISTINCT ON` de s05 change), et toute URL ou tout test portant l'id devient faux. L'AC est écrite pour attraper exactement ce raccourci — un test qui compte les sessions avant/après est le minimum, mais il ne suffit pas : il faut aussi vérifier que l'`id` est conservé.

### 5. Atomicité impossible « gratuitement » avec le driver HTTP

Voir Verified APIs : `drizzle-orm/neon-http` **lève** sur `transaction()`. Une édition qui supprime N lignes et en met à jour M n'est atomique que via `db.batch([...])` (transaction HTTP non interactive) ou en basculant sur `neon-serverless`. Sans cela, un échec réseau à mi-chemin laisse une session dans un état mixte — et c'est précisément une story dont la raison d'être est de réparer des données. À trancher au plan, en cohérence avec le driver choisi par s01/s03.

### 6. La suppression d'une session doit emporter ses mesures

Deux voies : `references(() => measurementSessions.id, { onDelete: "cascade" })` dans le schéma de s03, ou une suppression explicite des `measurements` avant la session — qui retombe alors sur le § 5 (atomicité). **Le schéma de s03 n'existe pas** : impossible de savoir aujourd'hui si la cascade est déclarée. Si elle ne l'est pas, la suppression échouera sur la contrainte FK, ou laissera des lignes orphelines si la FK n'est pas déclarée du tout.

### 7. Le référentiel des deltas ne se mémorise pas (AC 7)

`docs/stories.md:252` et la recherche s06 (§ Traps 4) posent le même point : le delta de la silhouette se calcule contre la **première mesure enregistrée pour ce `kind`**, obtenue par requête (`DISTINCT ON (kind) … ORDER BY kind, measured_on ASC`). Corriger ou supprimer la première session **déplace ce référentiel**. Toute mémoïsation — colonne « valeur initiale », cache applicatif, `unstable_cache` non invalidé — se désynchronise ici. Si s06 ou s07 introduisent un cache, s09 doit l'invalider ; c'est un point à vérifier à la lecture du code livré, pas à supposer.

### 8. L'autorisation vit dans la mutation, pas dans la page (AC 6)

`data-security.md:339` : « A page-level authentication check does not extend to the Server Actions defined within it. » Et `07-mutating-data.md:31` : les Server Functions sont joignables par POST direct. Donc :
- l'identité vient **toujours** de `auth.getSession()` → `session.data.user.id` ;
- l'`id` de session reçu du client est une **donnée non fiable** : il faut relire la ressource et vérifier son `user_id`, ou filtrer la mutation par `and(eq(sessions.id, id), eq(sessions.user_id, userId))` et exiger `returning()` non vide ;
- le test d'accès croisé exigé par l'AC doit appeler la mutation **directement** (pas via l'UI) avec l'id d'un autre utilisateur.

Un `.where()` oublié sur un `db.delete()` supprime toute la table (`db.d.ts:256`). Sur cette story-là, ce n'est pas une remarque théorique.

### 9. `PageProps` / `RouteContext` sont générés — l'ordre des commandes compte

s09 introduit **le premier segment dynamique du projet**. Or ces helpers ne sont pas dans le paquet `next` : ils sont écrits par le typegen dans `.next/types/routes.d.ts`, dont le contenu actuel est littéralement `type AppRoutes = "/"`. Écrire `PageProps<'/sessions/[id]'>` **avant** un `next dev` / `next build` qui régénère ce fichier fera échouer `npm run typecheck` — et `npm run check` est la commande de la review. L'annotation explicite `{ params: Promise<{ id: string }> }` (documentée en `dynamic-routes.md:20-28`) évite entièrement cette dépendance d'ordre.

### 10. `revalidatePath` sur un chemin dynamique exige le paramètre `type`

`revalidatePath.md` : « If `path` contains a dynamic segment, for example `/product/[slug]`, this parameter is required. » Et depuis un **route handler**, la revalidation n'a lieu qu'à la prochaine visite du chemin, alors que depuis une **Server Action** elle met à jour l'UI immédiatement. Ce détail décide en partie du choix Server Action vs route handler pour les AC 5 et 7.

### 11. `redirect()` lève : revalider d'abord, rediriger ensuite

`07-mutating-data.md:500` et `redirect.md:51-53`. Après une suppression, l'ordre est : invalider (`revalidatePath` / `refresh`) puis `redirect` — et jamais `redirect` dans un `try`.

### 12. Le cache navigateur back/forward n'est pas couvert par `staleTimes`

`staleTimes.md:36` : « This doesn't change back/forward caching behavior ». Le défaut `dynamic: 0` protège la navigation par lien, pas le bouton Retour. L'AC 5 (« une session supprimée disparaît de l'historique ») doit être testée sur un vrai parcours navigateur, pas seulement sur un rendu serveur.

### 13. `alert-dialog` est `"use client"` — il crée une île cliente dans la liste

La liste d'historique de s03 est un candidat naturel au Server Component. Y poser un `AlertDialogTrigger` force le passage en client, sauf à isoler le bouton de suppression dans un petit composant client dédié (`src/components/`), la liste restant serveur. `separator` (tiré par `item`) est aussi `"use client"`, mais seulement pour `ItemSeparator`. `docs/architecture.md` § Composants : `"use client"` seulement là où l'interactivité l'impose.

### 14. Le texte de la boîte de confirmation est contraint

`docs/design-system.md` § Feedback : « Action destructive (supprimer une session) → `alert-dialog`, **avec le contenu concerné nommé dans le texte** ». Une confirmation générique (« Êtes-vous sûr ? ») ne satisfait pas la règle. Le texte doit nommer la session — vraisemblablement sa date. UI en français (`AGENTS.md`).

### 15. Cibles tactiles et variante `destructive` atténuée

`Button` fait `h-8` (32 px) par défaut, `h-9` en `lg`, `size-8` en `icon` — sous le repère iOS de 44 px, sur un écran où l'on manipule une action destructive au doigt. `docs/design-system.md` **ne définit aucun token de cible tactile** : c'est un *design system gap* déjà signalé par les recherches s05 (§ 9) et s06 (§ 15), à remonter, jamais à combler par un `h-11` arbitraire. Par ailleurs la variante `destructive` du preset est un fond `destructive/10` translucide : son contraste doit être vérifié **en clair et en sombre** (règle du design system), ce qui est aujourd'hui impossible puisque la classe `dark` n'est posée par personne.

### 16. Suppression définitive, sans corbeille

`docs/stories.md:253`. Pas de `deleted_at`, pas de suppression logique. Un agent qui ajoute une corbeille « par prudence » sort du périmètre et doit passer par un ADR.

### 17. Éditer la date d'une session ré-ouvre le départage du `DISTINCT ON`

La recherche s05 (§ Traps 3) a relevé que `DISTINCT ON (kind) ORDER BY kind, measured_on DESC` est **non déterministe** si deux sessions partagent la même `measured_on`, et qu'un critère secondaire (`created_at DESC`, `id DESC`) est nécessaire. Si l'écran d'édition permet de modifier la date, s09 rend ce cas banal (deux sessions le même jour). Le point n'est tranché ni par l'ADR 004 ni par l'architecture.

### 18. La validation serveur s'applique aussi à l'édition

`AGENTS.md` : « Validate every payload with Zod on the server, even when the client already did. Physiological ranges are declared per measurement `kind`, in one place. » L'édition ne doit pas ouvrir un second chemin de validation : elle réutilise le module de s03. Attention aussi à Zod 4 (voir Verified APIs) : `flatten()` est déprécié.

### 19. Contraintes de dépôt à ne pas enfreindre

`src/components/ui/` est généré par la CLI shadcn et **ne s'édite pas à la main** ; aucune couleur en dur ni valeur arbitraire ; **ne jamais installer `@vitejs/plugin-react`** ([ADR 005](../decisions/005-testing-stack.md) : tire `@babel/core@8.0.0-rc`, conflit avec `shadcn`) ; le schéma `neon_auth` reste hors de portée de Drizzle (`schemaFilter: ["public"]`) ; le travail se fait sur `feature/s09-edit-delete-session` uniquement, et ne s'exécute que si `docs/plans/s09-edit-delete-session.md` porte `validated: yes`.

### 20. État du harnais de test

- `npm run check` est **rouge aujourd'hui** (`vitest run` sort en 1 sans fichier de test) : ce n'est pas une régression de s09, à mentionner en review pour éviter un faux positif.
- **Aucune base de test n'est tranchée** ([ADR 005](../decisions/005-testing-stack.md) renvoie explicitement le choix à `/ks-research s03`, qui n'a pas eu lieu). Or l'AC 6 exige un test d'accès croisé — c'est le trou le plus direct pour cette story.
- **Webkit n'est pas installé** (`chromium` seul), alors que le projet Playwright `mobile` est en `devices["iPhone 13"]` → `webkit`. `npx playwright install webkit` est un préalable.
- Le viewport du projet `mobile` fait **390 px**, pas 375 (relevé par s06 § 10) : toute vérification à 375 px doit fixer le viewport explicitement.
- jsdom ne mesure aucune mise en page : un test Vitest ne peut pas prouver un comportement navigateur (ADR 005).

---

## Open questions

1. **Où vit l'écran d'édition, et sous quelle forme ?** Route dédiée avec segment dynamique (`/sessions/[id]`…), route intercepté, ou modale ? La route de la liste elle-même est décidée par s03, qui n'est pas explorée. Indécidable ici.
2. **Server Action ou route handler ?** `docs/architecture.md:58` dit « Toute donnée transite par un Server Component ou un route handler » sans nommer la Server Action, alors que c'est le chemin idiomatique de Next 16 et que `refresh()` n'est appelable **que** depuis une Server Action. La même question est déjà ouverte dans la recherche s04. Elle mérite probablement un ADR unique pour tout le projet, pas une réponse par story.
3. **Stratégie de mise à jour des mesures** : diff (upsert des modifiées + delete des vidées) ou « tout supprimer puis réinsérer » à l'intérieur d'un `db.batch` ? La seconde est plus simple et reste compatible avec l'AC 2 (la *session* n'est pas recréée), mais fait bouger les `id` des lignes `measurements` — sans conséquence connue aujourd'hui, à confirmer contre le schéma de s03.
4. **La date de la session est-elle modifiable en édition ?** Les AC parlent de « ses valeurs réellement enregistrées » sans trancher pour `measured_on`. La réponse conditionne le § 17 des Traps.
5. **Que se passe-t-il si l'utilisateur vide *tous* les champs en édition ?** s03 refuse un formulaire entièrement vide à la création. En édition, faut-il refuser, ou considérer que c'est une suppression implicite de la session ? Aucun AC ne le dit.
6. **404 ou 403 sur un accès croisé ?** Renvoyer 404 (`notFound()`) ne divulgue pas l'existence de la ressource ; 403 est plus explicite mais fuit. À noter : `forbidden()` exige `experimental.authInterrupts: true`, aujourd'hui absent de `next.config.ts`. Choix de sécurité à acter.
7. **La FK `measurements.session_id` déclare-t-elle `onDelete: "cascade"` ?** Dépend du schéma de s03, inexistant.
8. **Quel driver Drizzle** (`neon-http` ou `neon-serverless`) est retenu par s01/s03 ? La réponse décide de la disponibilité des transactions (Traps § 5).
9. **Où vit l'action « supprimer »** : sur la ligne d'historique, sur l'écran d'édition, ou aux deux endroits ? Et quelle icône ? `docs/design-system.md` § Gaps connus, point 2 : « la librairie est `lucide`, mais **aucune icône n'est encore attribuée à une action** ». C'est un *design system gap* à remonter, pas à trancher à la volée.
10. **Que fait-on après un enregistrement ou une suppression réussis ?** Toast `sonner` et rester, ou rediriger vers la liste / la silhouette ? Le design system impose le toast pour un succès mais ne dit rien de la navigation.
11. **s06 et s07 introduisent-ils un cache** (`unstable_cache`, `use cache`, mémoïsation) qu'il faudrait invalider ? Invérifiable : ces stories n'existent pas.
12. **Base de test** pour l'AC 6 (accès croisé) — trou connu de l'[ADR 005](../decisions/005-testing-stack.md), explicitement renvoyé à `/ks-research s03`, qui n'a pas encore eu lieu.
13. **Format d'affichage des valeurs pré-remplies en édition** (`72.4` ou `72,4`) et parseur correspondant — question ouverte héritée de s05, non tranchée par aucun document du projet.
14. **Départage du `DISTINCT ON`** (`created_at DESC` puis `id DESC` ?) — hérité de s05, rendu plus pressant par l'édition de date (Traps § 17).
15. **Nom et clé primaire de la table `neon_auth`** — toujours introuvables dans le paquet (confirmé indépendamment ici). Bloque le schéma de s03, donc s09 en cascade.

---

## Blockers

Rien de ce qui suit ne se contourne par du code :

- **Aucune credential.** Pas de `DATABASE_URL`, pas de `NEON_AUTH_BASE_URL`, pas de `NEON_AUTH_COOKIE_SECRET`, pas de `.env`, **pas de CLI Neon, pas de CLI Vercel**. Impossible de générer ou d'appliquer une migration (`drizzle.config.ts` lit `process.env.DATABASE_URL!`), de vérifier le comportement réel d'un `ON DELETE CASCADE`, de mesurer le cold start, ou de faire tourner le moindre test d'isolation contre un vrai Postgres.
- **s01 à s08 ne sont pas implémentées**, et **s03 n'a même pas de document de research**. s09 n'a aucun code sur lequel se greffer : ni schéma, ni liste, ni formulaire, ni silhouette, ni graphes. Les AC 5 et 7 portent sur des vues qui n'existent pas.
- **Aucune base de test n'est décidée** ([ADR 005](../decisions/005-testing-stack.md)). L'AC 6 exige un test d'accès croisé serveur : il ne peut pas être écrit tant que ce choix n'est pas fait.
- **Webkit Playwright n'est pas installé** (`~/Library/Caches/ms-playwright` ne contient que chromium) : le projet `mobile` ne peut pas s'exécuter.
- **Le nom de la table de synchronisation `neon_auth` reste inconnu** : il conditionne la clé étrangère `measurement_sessions.user_id`, donc toute vérification de propriété de s09.
